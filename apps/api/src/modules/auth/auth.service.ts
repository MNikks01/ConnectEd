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
  SchoolWebOnlyError,
  UnauthenticatedError,
} from '../../shared/errors/index.js';

import type { AuthRepository } from './auth.repository.js';
import type { LoginInput, RegisterIndividualInput, RegisterSchoolInput } from './auth.schema.js';
import type { PasswordHasher } from '../../shared/auth/password.js';
import type { TokenService } from '../../shared/auth/tokens.js';
import type { Logger } from '../../shared/logger/index.js';
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
  currentAccount: (accountId: string) => Promise<CurrentAccount>;
}

export interface AuthServiceDeps {
  repository: AuthRepository;
  passwords: PasswordHasher;
  tokens: TokenService;
  logger: Logger;
}

export function createAuthService({
  repository,
  passwords,
  tokens,
  logger,
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
        }),
      );

      logger.info({ accountId: account.id, accountType: 'SCHOOL' }, 'Account registered');

      return issueSession({ id: account.id, type: 'SCHOOL', role: null });
    },

    login: async (input: LoginInput, clientType: ClientType) => {
      const account = await repository.findAccountForLogin(input.email);

      const passwordMatches = await passwords.verify(
        account?.passwordHash ?? (await getDummyHash()),
        input.password,
      );

      if (!account || !passwordMatches) {
        // The email itself is never logged: failed-login logs would otherwise become a list of
        // addresses worth attacking.
        logger.warn({ outcome: 'invalid_credentials' }, 'Login failed');
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
