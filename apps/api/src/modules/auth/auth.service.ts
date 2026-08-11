/**
 * Auth domain logic (FR-AUTH-001..007).
 *
 * Two rules shape almost everything here:
 *
 * 1. **No user enumeration.** Login failures are one generic error regardless of whether the
 *    email exists, and registration conflicts say only that the account could not be created.
 *    An endpoint that distinguishes them is a membership oracle.
 * 2. **Refresh reuse means theft.** Presenting an already-rotated token revokes the entire
 *    family, because the only way that happens is a stolen token racing the legitimate client.
 */
import { randomBytes } from 'node:crypto';

import { randomFromAlphabet } from '../../shared/auth/random.js';
import { generateTotpSecret, otpauthUri, verifyTotp } from '../../shared/auth/totp.js';

import {
  AppError,
  ConflictError,
  DependencyUnavailableError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  SchoolWebOnlyError,
  UnauthenticatedError,
} from '../../shared/errors/index.js';

import type { AuthRepository } from './auth.repository.js';
import type { LoginInput, RegisterIndividualInput, RegisterSchoolInput } from './auth.schema.js';
import type { PasswordHasher } from '../../shared/auth/password.js';
import type { TokenService } from '../../shared/auth/tokens.js';
import type { Actor } from '../../shared/authz/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Mailer } from '../../shared/mail/index.js';
import type { SecretBox } from '../../shared/auth/secret-box.js';
import type {
  TwoFactorChallengeResponse as TwoFactorChallenge,
  TwoFactorConfirmedResponse,
  TwoFactorEnrolmentResponse,
} from '@connected/types';
import type { AccountType, UserRole } from '../../generated/prisma/client.js';

export interface AuthSession {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface CurrentAccount {
  id: string;
  email: string;
  accountType: AccountType;
  status: string;
  emailVerified: boolean;
  role: UserRole | null;
  fullName: string | null;
  handle: string | null;
  schoolName: string | null;
}

export type ClientType = 'web' | 'mobile';

export interface AuthService {
  registerIndividual: (input: RegisterIndividualInput) => Promise<AuthSession>;
  registerSchool: (input: RegisterSchoolInput) => Promise<AuthSession>;
  /**
   * Returns a session, or a challenge when the account has a confirmed second factor. The caller
   * branches on `twoFactorRequired`, which is absent from a session.
   */
  login: (input: LoginInput, clientType: ClientType) => Promise<AuthSession | TwoFactorChallenge>;
  refresh: (token: string) => Promise<AuthSession>;
  logout: (token: string | undefined) => Promise<void>;
  /**
   * FR-AUTH-009. Always resolves, whatever happened.
   *
   * The response must not depend on whether the address is registered — an endpoint that answers
   * differently is an account-enumeration oracle, and this one is unauthenticated and rate-limited
   * precisely because strangers will call it. So a missing account, a failed send, and a
   * successful send are indistinguishable from outside.
   */
  requestPasswordReset: (email: string) => Promise<void>;
  /** FR-AUTH-009. Throws when the token is unknown, expired, or already spent. */
  resetPassword: (token: string, password: string) => Promise<void>;
  /** Housekeeping: drops throttle rows nobody is backing off any more. Returns how many. */
  sweepLoginThrottles: () => Promise<number>;
  /** FR-AUTH-012. Starts enrolment; the secret is not trusted until a code confirms it. */
  startTwoFactorEnrolment: (actor: Actor) => Promise<TwoFactorEnrolmentResponse>;
  /** FR-AUTH-012. Confirms enrolment and issues the recovery codes, once. */
  confirmTwoFactorEnrolment: (actor: Actor, code: string) => Promise<TwoFactorConfirmedResponse>;
  /** FR-AUTH-012. Turns it off. Requires a current code, so a borrowed session cannot. */
  disableTwoFactor: (actor: Actor, code: string) => Promise<void>;
  /** FR-AUTH-012. Second leg of a login: a challenge plus a code. */
  completeTwoFactorLogin: (
    challengeToken: string,
    code: string,
    clientType: ClientType,
  ) => Promise<AuthSession>;
  currentAccount: (accountId: string) => Promise<CurrentAccount>;
}

/**
 * The slice of billing that auth needs: what trial a new school starts on (FR-BILL-001).
 *
 * A narrow port rather than the whole service, and plain data rather than a Prisma write, so the
 * two modules stay independent while the subscription still lands in the school's own transaction.
 */
export interface TrialTermsSource {
  trialTerms: () => { planCode: string; periodStart: Date; periodEnd: Date };
}

/**
 * How long a reset link lives. `FR-AUTH-009` says at most thirty minutes, and thirty is the right
 * end of that range: shorter turns a delayed email into a dead link, which sends people back to
 * the form to generate another one.
 */
const PASSWORD_RESET_TTL_MINUTES = 30;

/**
 * Failed-login backoff (FR-AUTH-011).
 *
 * The IP limiter in front of these routes stops one machine hammering the API. It does nothing
 * about one account attacked from a thousand machines, which is exactly what a credential-stuffing
 * list is for — so this throttles per address as well.
 *
 * **Backoff, never lockout.** A block that does not lift is a denial of service against any
 * account whose address somebody knows, and the address is the one part of a credential that is
 * routinely public. Five wrong attempts buys a minute; it doubles from there to a quarter of an
 * hour, which costs an attacker orders of magnitude and costs somebody who mistyped their password
 * a cup of tea.
 */
const LOGIN_FAILURES_BEFORE_BACKOFF = 5;
const LOGIN_BACKOFF_BASE_MS = 60_000;
const LOGIN_BACKOFF_CAP_MS = 15 * 60_000;

/** How long a quiet throttle row survives before the nightly sweep drops it. */
export const LOGIN_THROTTLE_RETENTION_HOURS = 24;

/**
 * How long the gap between password and code may last.
 *
 * Five minutes: long enough to find a phone that is charging in another room, short enough that a
 * challenge left on a shared screen is worthless by the time anybody looks.
 */
const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 300;

/** Ten codes, each 8 characters of Crockford-ish base32 — enough entropy, readable aloud. */
const RECOVERY_CODE_COUNT = 10;

/**
 * Ambiguity removed rather than explained: these get written on paper and read back later, so the
 * characters people confuse — I and 1, O and 0 — are simply absent.
 *
 * That leaves 31 characters, which does not divide 256, which is why this goes through
 * `randomFromAlphabet` rather than a modulo. See that file: the obvious version made the first
 * eight characters ⅛ more likely, in a credential that stands in for a second factor.
 */
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_LENGTH = 8;

function generateRecoveryCode(): string {
  return randomFromAlphabet(RECOVERY_CODE_LENGTH, RECOVERY_CODE_ALPHABET);
}

/**
 * Who may enrol. `FR-AUTH-012` says school admins and principals — the accounts that hold a
 * school's contract and its verification queue, and whose compromise reaches children's data.
 *
 * Not a blanket "everyone may": every enrolled account is one more person who can be locked out by
 * a lost phone, and offering it where it buys little is how a support burden is created.
 *
 * **Platform admins are the third case, and they were missing** (ASVS 4.3.1, found walking L2 on
 * 2026-08-11). `isPlatformAdmin` is a column independent of `type` and `role`, so ConnectEd staff
 * holding the moderation queue — the most privileged surface in the product (ADR-0017), which
 * reads reports *about* people at schools — could not enrol at all unless they happened also to be
 * a school account or a principal. The one interface the standard singles out for MFA was the one
 * that could not have it.
 *
 * It is checked from the database rather than from the actor for the same reason the queue's own
 * policy is: a claim is only as trustworthy as the narrowest place that mints one, and the
 * integration suite signs its own tokens.
 */
function mayEnrolInTwoFactor(actor: Actor, isPlatformAdmin: boolean): boolean {
  return actor.accountType === 'SCHOOL' || actor.role === 'PRINCIPAL' || isPlatformAdmin;
}

function backoffFor(failedCount: number): Date | null {
  if (failedCount < LOGIN_FAILURES_BEFORE_BACKOFF) return null;

  const doublings = failedCount - LOGIN_FAILURES_BEFORE_BACKOFF;
  const delay = Math.min(LOGIN_BACKOFF_BASE_MS * 2 ** doublings, LOGIN_BACKOFF_CAP_MS);

  return new Date(Date.now() + delay);
}

export interface AuthServiceDeps {
  repository: AuthRepository;
  passwords: PasswordHasher;
  tokens: TokenService;
  logger: Logger;
  billing: TrialTermsSource;
  mailer: Mailer;
  /** Encrypts TOTP secrets at rest. Absent when no key is configured, which disables enrolment. */
  secretBox?: SecretBox | undefined;
}

export function createAuthService({
  repository,
  passwords,
  tokens,
  logger,
  billing,
  mailer,
  secretBox,
}: AuthServiceDeps): AuthService {
  /**
   * A real argon2id hash of a random value, computed once. Logins for addresses that do not exist
   * are verified against it so they cost the same as a genuine wrong-password attempt — otherwise
   * response time answers "does this account exist?".
   */
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = (): Promise<string> => {
    dummyHash ??= passwords.hash(randomBytes(32).toString('hex'));
    return dummyHash;
  };

  /** Mints a fresh session. `familyId` is omitted for a new login and reused during rotation. */
  async function issueSession(
    account: { id: string; type: AccountType; role: UserRole | null },
    familyId?: string,
  ): Promise<AuthSession> {
    const accessToken = await tokens.signAccessToken({
      sub: account.id,
      accountType: account.type,
      ...(account.role ? { role: account.role } : {}),
    });

    const refresh = tokens.issueRefreshToken(familyId);

    await repository.storeRefreshToken({
      accountId: account.id,
      familyId: refresh.familyId,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
    });

    return {
      accessToken,
      expiresInSeconds: tokens.accessTokenTtlSeconds,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  return {
    registerIndividual: async (input: RegisterIndividualInput) => {
      const passwordHash = await passwords.hash(input.password);

      const account = await createOrConflict(() =>
        repository.createIndividual({
          email: input.email,
          passwordHash,
          algo: passwords.algo,
          fullName: input.fullName,
          handle: input.handle,
          mobile: input.mobile,
          gender: input.gender,
          dob: input.dob,
        }),
      );

      logger.info({ accountId: account.id, accountType: 'INDIVIDUAL' }, 'Account registered');

      return issueSession({ id: account.id, type: 'INDIVIDUAL', role: 'USER' });
    },

    registerSchool: async (input: RegisterSchoolInput) => {
      const passwordHash = await passwords.hash(input.password);

      const account = await createOrConflict(() =>
        repository.createSchool({
          email: input.email,
          passwordHash,
          algo: passwords.algo,
          name: input.name,
          adminName: input.adminName,
          phone: input.phone,
          city: input.city,
          state: input.state,
          country: input.country,
          // Every school starts on a trial, and starts on it in the same statement that creates
          // it — nobody has to remember to grant one, and none can be missed.
          trial: billing.trialTerms(),
        }),
      );

      logger.info(
        { accountId: account.id, accountType: 'SCHOOL' },
        'Account registered with trial subscription',
      );

      return issueSession({ id: account.id, type: 'SCHOOL', role: null });
    },

    login: async (input: LoginInput, clientType: ClientType) => {
      // Hashed, and applied whether or not the address is registered. Throttling only real
      // accounts would make the throttle an account-enumeration oracle: an attacker would learn
      // which addresses exist by noticing which ones start refusing.
      const emailHash = tokens.hashRefreshToken(input.email);
      const throttle = await repository.findLoginThrottle(emailHash);

      if (throttle?.blockedUntil && throttle.blockedUntil > new Date()) {
        logger.warn(
          { outcome: 'throttled', failedCount: throttle.failedCount },
          'Login refused while backing off',
        );
        // The same code every rate limit uses, so a client already handling 429 handles this.
        throw new RateLimitedError('Too many attempts. Please try again shortly.');
      }

      const account = await repository.findAccountForLogin(input.email);

      const passwordMatches = await passwords.verify(
        account?.passwordHash ?? (await getDummyHash()),
        input.password,
      );

      if (!account || !passwordMatches) {
        const recorded = await repository.recordLoginFailure(emailHash, null);
        const blockedUntil = backoffFor(recorded.failedCount);
        if (blockedUntil) await repository.recordLoginFailure(emailHash, blockedUntil);

        // The email itself is never logged: failed-login logs would otherwise become a list of
        // addresses worth attacking.
        logger.warn(
          { outcome: 'invalid_credentials', failedCount: recorded.failedCount },
          'Login failed',
        );
        throw new UnauthenticatedError('Email or password is incorrect.');
      }

      if (account.status !== 'ACTIVE') {
        throw new UnauthenticatedError('Email or password is incorrect.');
      }

      // School accounts are web-only (FR-AUTH-002, FR-AUTH-007). Checked *after* the password so
      // the rejection cannot be used to discover which addresses are school accounts.
      if (account.type === 'SCHOOL' && clientType === 'mobile') {
        logger.warn({ accountId: account.id }, 'School login rejected on mobile client');
        throw new SchoolWebOnlyError();
      }

      const enrolment = secretBox ? await repository.findTwoFactor(account.id) : null;

      if (enrolment?.confirmedAt) {
        // The password was right, and that is all it buys. The challenge is not a session and
        // grants nothing: presenting one only earns the right to be asked for a code.
        const challengeToken = randomBytes(32).toString('base64url');

        await repository.createTwoFactorChallenge({
          accountId: account.id,
          tokenHash: tokens.hashRefreshToken(challengeToken),
          expiresAt: new Date(Date.now() + TWO_FACTOR_CHALLENGE_TTL_SECONDS * 1000),
        });

        // Cleared here too: the password was correct, so this address is not under attack in the
        // way the throttle exists to slow.
        await repository.clearLoginThrottle(emailHash);

        logger.info({ accountId: account.id }, 'Login awaiting a second factor');

        return {
          twoFactorRequired: true,
          challengeToken,
          expiresInSeconds: TWO_FACTOR_CHALLENGE_TTL_SECONDS,
        };
      }

      // Cleared only after every other check has passed. Clearing on a correct password alone
      // would let somebody with valid credentials for a *web-only* school account reset the
      // counter from a phone, forever.
      await repository.clearLoginThrottle(emailHash);

      logger.info({ accountId: account.id }, 'Login succeeded');

      return issueSession({ id: account.id, type: account.type, role: account.role });
    },

    refresh: async (token: string) => {
      const stored = await repository.findRefreshToken(tokens.hashRefreshToken(token));

      if (!stored) {
        throw new UnauthenticatedError('Your session is invalid or has expired.');
      }

      // Reuse of a rotated token: the legitimate client already exchanged this one, so someone
      // else holds a copy. Kill every session in the family, not just this token.
      if (stored.revokedAt) {
        await repository.revokeFamily(stored.familyId);
        logger.warn(
          { accountId: stored.accountId, familyId: stored.familyId },
          'Refresh token reuse detected; family revoked',
        );

        throw new AppError(
          ErrorCode.TOKEN_REUSE_DETECTED,
          401,
          'Your session was ended for security reasons. Please sign in again.',
        );
      }

      if (stored.expiresAt.getTime() <= Date.now()) {
        throw new UnauthenticatedError('Your session is invalid or has expired.');
      }

      const next = tokens.issueRefreshToken(stored.familyId);

      await repository.rotateRefreshToken({
        previousId: stored.id,
        accountId: stored.accountId,
        familyId: stored.familyId,
        tokenHash: next.tokenHash,
        expiresAt: next.expiresAt,
      });

      const accessToken = await tokens.signAccessToken({
        sub: stored.accountId,
        accountType: stored.accountType,
        ...(stored.role ? { role: stored.role } : {}),
      });

      return {
        accessToken,
        expiresInSeconds: tokens.accessTokenTtlSeconds,
        refreshToken: next.token,
        refreshExpiresAt: next.expiresAt,
      };
    },

    /** Idempotent: logging out with an unknown or absent token still succeeds. */
    logout: async (token: string | undefined) => {
      if (!token) return;

      const stored = await repository.findRefreshToken(tokens.hashRefreshToken(token));
      if (!stored) return;

      await repository.revokeFamily(stored.familyId);
      logger.info({ accountId: stored.accountId }, 'Logged out');
    },

    requestPasswordReset: async (email) => {
      const accountId = await repository.findAccountIdByEmail(email);

      if (!accountId) {
        // Logged without the address: a warn stream of "no account for x@y" is a list of
        // addresses somebody has been probing, and a list of addresses that are *not* registered
        // is still information about the ones that are.
        logger.info({ outcome: 'no_account' }, 'Password reset requested');
        return;
      }

      const token = randomBytes(32).toString('base64url');

      await repository.createPasswordResetToken({
        accountId,
        // Hashed, like a refresh token. A database dump must not hand over live reset links.
        tokenHash: tokens.hashRefreshToken(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      });

      try {
        await mailer.sendPasswordReset({
          to: email,
          token,
          expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
        });
      } catch (error) {
        // The row exists and the link is valid; only delivery failed. Loud in the logs, silent to
        // the caller, because telling them would also tell a stranger that the address is real.
        logger.error({ err: error, accountId }, 'Could not send a password-reset email');
      }
    },

    resetPassword: async (token, password) => {
      const passwordHash = await passwords.hash(password);

      const applied = await repository.consumePasswordResetToken({
        tokenHash: tokens.hashRefreshToken(token),
        passwordHash,
        algo: passwords.algo,
        now: new Date(),
      });

      if (!applied) {
        // Unknown, expired, and already used are one answer. Distinguishing them tells somebody
        // holding a stolen link which part to work on.
        logger.warn({ outcome: 'invalid_reset_token' }, 'Password reset failed');
        throw new UnauthenticatedError('That reset link is invalid or has expired.');
      }

      logger.info('Password reset completed; all sessions revoked');
    },

    startTwoFactorEnrolment: async (actor) => {
      // Read first: eligibility now depends on `isPlatformAdmin`, which is deliberately not a
      // token claim (ADR-0017).
      const account = await repository.findActorAccount(actor.accountId);
      if (!account) throw new UnauthenticatedError();

      if (!mayEnrolInTwoFactor(actor, account.isPlatformAdmin)) {
        throw new ForbiddenError(
          'Two-factor authentication is for school, principal and ConnectEd staff accounts.',
        );
      }

      if (!secretBox) {
        // Rather than storing a second factor in the clear. A feature that quietly degrades to
        // plaintext credentials is worse than one that says it is unavailable.
        throw new DependencyUnavailableError('Two-factor authentication is not configured.');
      }

      const secret = generateTotpSecret();
      await repository.startTwoFactorEnrolment(actor.accountId, secretBox.seal(secret));

      // Logged without the secret or the URI that contains it.
      logger.info({ accountId: actor.accountId }, 'Two-factor enrolment started');

      return {
        secret,
        otpauthUri: otpauthUri({ secret, account: account.email, issuer: 'ConnectEd' }),
      };
    },

    confirmTwoFactorEnrolment: async (actor, code) => {
      if (!secretBox)
        throw new DependencyUnavailableError('Two-factor authentication is not configured.');

      const enrolment = await repository.findTwoFactor(actor.accountId);
      if (!enrolment) throw new NotFoundError();

      if (!verifyTotp(secretBox.open(enrolment.secret), code)) {
        // Nothing is activated. An enrolment trusted before a first correct code locks people out
        // of their own accounts when the QR scan silently failed.
        throw new UnauthenticatedError('That code is not right. Try the next one.');
      }

      const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
      await repository.confirmTwoFactor(
        actor.accountId,
        codes.map((value) => tokens.hashRefreshToken(value)),
      );

      logger.info({ accountId: actor.accountId }, 'Two-factor enrolment confirmed');

      // Returned once. They are hashed the moment they leave here, so this response is the only
      // time they exist in readable form anywhere.
      return { recoveryCodes: codes };
    },

    disableTwoFactor: async (actor, code) => {
      if (!secretBox)
        throw new DependencyUnavailableError('Two-factor authentication is not configured.');

      const enrolment = await repository.findTwoFactor(actor.accountId);
      if (!enrolment?.confirmedAt) throw new NotFoundError();

      // A current code, not merely a session. Otherwise a borrowed laptop can remove the factor
      // that exists to make a borrowed laptop insufficient.
      const secret = secretBox.open(enrolment.secret);
      const byCode = verifyTotp(secret, code);
      const byRecovery =
        !byCode &&
        (await repository.consumeRecoveryCode(actor.accountId, tokens.hashRefreshToken(code)));

      if (!byCode && !byRecovery) {
        throw new UnauthenticatedError('That code is not right.');
      }

      await repository.disableTwoFactor(actor.accountId);
      logger.warn({ accountId: actor.accountId }, 'Two-factor authentication disabled');
    },

    completeTwoFactorLogin: async (challengeToken, code, clientType) => {
      if (!secretBox)
        throw new DependencyUnavailableError('Two-factor authentication is not configured.');

      const accountId = await repository.consumeTwoFactorChallenge(
        tokens.hashRefreshToken(challengeToken),
        new Date(),
      );

      if (!accountId) {
        // Unknown, expired and already-spent are one answer, as everywhere else here.
        throw new UnauthenticatedError('That sign-in attempt has expired. Start again.');
      }

      const enrolment = await repository.findTwoFactor(accountId);
      const account = await repository.findActorAccount(accountId);

      if (!enrolment?.confirmedAt || !account) throw new UnauthenticatedError();

      const secret = secretBox.open(enrolment.secret);
      const byCode = verifyTotp(secret, code);
      const byRecovery =
        !byCode && (await repository.consumeRecoveryCode(accountId, tokens.hashRefreshToken(code)));

      if (!byCode && !byRecovery) {
        logger.warn({ accountId, outcome: 'bad_second_factor' }, 'Two-factor login failed');
        throw new UnauthenticatedError('That code is not right.');
      }

      if (byRecovery) {
        // Worth its own line in the log: somebody using a paper code has lost their phone, and a
        // run of them is either a compromise or a support problem.
        logger.warn({ accountId }, 'Two-factor login used a recovery code');
      }

      // Re-checked here rather than trusted from the first leg: the account may have been
      // suspended in the five minutes between password and code.
      if (account.status !== 'ACTIVE')
        throw new UnauthenticatedError('Email or password is incorrect.');
      if (account.type === 'SCHOOL' && clientType === 'mobile') throw new SchoolWebOnlyError();

      logger.info({ accountId }, 'Login succeeded with a second factor');

      return issueSession({ id: account.id, type: account.type, role: account.role });
    },

    sweepLoginThrottles: async () => {
      const before = new Date(Date.now() - LOGIN_THROTTLE_RETENTION_HOURS * 60 * 60 * 1000);
      const removed = await repository.sweepLoginThrottles(before);

      if (removed > 0) logger.info({ removed }, 'Swept login throttles');
      return removed;
    },

    currentAccount: async (accountId: string) => {
      const account = await repository.findActorAccount(accountId);

      // The token verified but the account is gone — treat it as an invalid session.
      if (!account) throw new UnauthenticatedError('Your session is invalid or has expired.');

      return {
        id: account.id,
        email: account.email,
        accountType: account.type,
        status: account.status,
        emailVerified: account.emailVerifiedAt !== null,
        // So the web app knows whether to offer the console. It is a hint for navigation only —
        // every moderation endpoint re-reads the row itself (ADR-0017).
        isPlatformAdmin: account.isPlatformAdmin,
        twoFactorEnabled: account.twoFactorEnabled,
        role: account.role,
        fullName: account.fullName,
        handle: account.handle,
        schoolName: account.schoolName,
      };
    },
  };
}

/** Unique-constraint violations become a deliberately vague 409 to avoid enumerating accounts. */
async function createOrConflict<T>(create: () => Promise<T>): Promise<T> {
  try {
    return await create();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('That account could not be created.');
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
