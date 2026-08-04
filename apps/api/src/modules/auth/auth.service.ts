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

import {
  AppError,
  ConflictError,
  ErrorCode,
  RateLimitedError,
  SchoolWebOnlyError,
  UnauthenticatedError,
} from '../../shared/errors/index.js';

import type { AuthRepository } from './auth.repository.js';
import type { LoginInput, RegisterIndividualInput, RegisterSchoolInput } from './auth.schema.js';
import type { PasswordHasher } from '../../shared/auth/password.js';
import type { TokenService } from '../../shared/auth/tokens.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Mailer } from '../../shared/mail/index.js';
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
  login: (input: LoginInput, clientType: ClientType) => Promise<AuthSession>;
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
}

export function createAuthService({
  repository,
  passwords,
  tokens,
  logger,
  billing,
  mailer,
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
