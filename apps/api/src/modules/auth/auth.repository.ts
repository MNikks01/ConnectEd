/**
 * Auth persistence. **The only file in this module that touches Prisma** (`apps/api/CLAUDE.md`
 * rule 1) — the service depends on this interface, not on the client.
 */
import type { Db } from '../../shared/db/index.js';
import type { AccountType, UserRole } from '../../generated/prisma/client.js';

export interface AccountWithCredential {
  id: string;
  type: AccountType;
  status: string;
  passwordHash: string | null;
  role: UserRole | null;
}

export interface StoredRefreshToken {
  id: string;
  accountId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  accountType: AccountType;
  role: UserRole | null;
}

export interface AuthRepository {
  findAccountForLogin: (email: string) => Promise<AccountWithCredential | null>;
  createIndividual: (input: CreateIndividualInput) => Promise<{ id: string }>;
  createSchool: (input: CreateSchoolInput) => Promise<{ id: string }>;
  findRefreshToken: (tokenHash: string) => Promise<StoredRefreshToken | null>;
  storeRefreshToken: (input: StoreRefreshTokenInput) => Promise<void>;
  rotateRefreshToken: (input: RotateRefreshTokenInput) => Promise<void>;
  revokeFamily: (familyId: string) => Promise<void>;
  findActorAccount: (accountId: string) => Promise<ActorAccount | null>;
}

export interface CreateIndividualInput {
  email: string;
  passwordHash: string;
  algo: string;
  fullName: string;
  handle: string;
  mobile?: string | undefined;
  gender?: string | undefined;
  dob?: string | undefined;
}

/**
 * The terms of the trial a new school starts on. Owned by the billing module and passed in as
 * plain data — this repository writes the row, but it does not decide what a trial is.
 */
export interface TrialInput {
  planCode: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface CreateSchoolInput {
  email: string;
  passwordHash: string;
  algo: string;
  name: string;
  /** FR-BILL-001, P0. Not optional: a school without a subscription cannot be reasoned about. */
  trial: TrialInput;
  adminName?: string | undefined;
  phone?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  country?: string | undefined;
}

export interface StoreRefreshTokenInput {
  accountId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RotateRefreshTokenInput {
  previousId: string;
  accountId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface ActorAccount {
  id: string;
  type: AccountType;
  email: string;
  status: string;
  emailVerifiedAt: Date | null;
  role: UserRole | null;
  fullName: string | null;
  handle: string | null;
  schoolName: string | null;
}

export function createAuthRepository(db: Db): AuthRepository {
  return {
    findAccountForLogin: async (email: string) => {
      const account = await db.account.findUnique({
        where: { email },
        select: {
          id: true,
          type: true,
          status: true,
          credential: { select: { passwordHash: true } },
          userProfile: { select: { role: true } },
        },
      });

      if (!account) return null;

      return {
        id: account.id,
        type: account.type,
        status: account.status,
        passwordHash: account.credential?.passwordHash ?? null,
        role: account.userProfile?.role ?? null,
      };
    },

    /** Account, credential, and profile must appear together or not at all. */
    createIndividual: (input: CreateIndividualInput) =>
      db.account.create({
        data: {
          email: input.email,
          type: 'INDIVIDUAL',
          credential: { create: { passwordHash: input.passwordHash, algo: input.algo } },
          userProfile: {
            create: {
              fullName: input.fullName,
              handle: input.handle,
              // Registration always yields the general role; academic roles require verification
              // (FR-AUTH-001, FR-AUTH-008).
              role: 'USER',
              ...(input.mobile ? { mobile: input.mobile } : {}),
              ...(input.gender ? { gender: input.gender } : {}),
              ...(input.dob ? { dob: new Date(input.dob) } : {}),
            },
          },
        },
        select: { id: true },
      }),

    /**
     * Account, credential, profile **and trial subscription** — one nested create, so they are one
     * statement and one transaction. There is no window in which a school exists without a
     * subscription, which is what makes `FR-BILL-001` an invariant rather than a follow-up write
     * that can fail on its own.
     *
     * The plan is `connect`ed by code rather than looked up first: if the catalogue is missing,
     * registration fails loudly here instead of quietly producing a school nothing can price.
     */
    createSchool: (input: CreateSchoolInput) =>
      db.account.create({
        data: {
          email: input.email,
          type: 'SCHOOL',
          credential: { create: { passwordHash: input.passwordHash, algo: input.algo } },
          schoolProfile: {
            create: {
              name: input.name,
              subscription: {
                create: {
                  status: 'TRIALING',
                  periodStart: input.trial.periodStart,
                  periodEnd: input.trial.periodEnd,
                  plan: { connect: { code: input.trial.planCode } },
                },
              },
              ...(input.adminName ? { adminName: input.adminName } : {}),
              ...(input.phone ? { phone: input.phone } : {}),
              ...(input.city ? { city: input.city } : {}),
              ...(input.state ? { state: input.state } : {}),
              ...(input.country ? { country: input.country } : {}),
            },
          },
        },
        select: { id: true },
      }),

    findRefreshToken: async (tokenHash: string) => {
      const token = await db.refreshToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          accountId: true,
          familyId: true,
          expiresAt: true,
          revokedAt: true,
          account: { select: { type: true, userProfile: { select: { role: true } } } },
        },
      });

      if (!token) return null;

      return {
        id: token.id,
        accountId: token.accountId,
        familyId: token.familyId,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        accountType: token.account.type,
        role: token.account.userProfile?.role ?? null,
      };
    },

    storeRefreshToken: async (input: StoreRefreshTokenInput) => {
      await db.refreshToken.create({ data: input });
    },

    /**
     * Rotation is one transaction: the old token is revoked and the new one created together.
     * Split across two writes, a crash between them would either strand a live old token or
     * lock the user out.
     */
    rotateRefreshToken: async (input: RotateRefreshTokenInput) => {
      await db.$transaction([
        db.refreshToken.update({
          where: { id: input.previousId },
          data: { revokedAt: new Date() },
        }),
        db.refreshToken.create({
          data: {
            accountId: input.accountId,
            familyId: input.familyId,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
          },
        }),
      ]);
    },

    revokeFamily: async (familyId: string) => {
      await db.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    findActorAccount: async (accountId: string) => {
      const account = await db.account.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          type: true,
          email: true,
          status: true,
          emailVerifiedAt: true,
          userProfile: { select: { role: true, fullName: true, handle: true } },
          schoolProfile: { select: { name: true } },
        },
      });

      if (!account) return null;

      return {
        id: account.id,
        type: account.type,
        email: account.email,
        status: account.status,
        emailVerifiedAt: account.emailVerifiedAt,
        role: account.userProfile?.role ?? null,
        fullName: account.userProfile?.fullName ?? null,
        handle: account.userProfile?.handle ?? null,
        schoolName: account.schoolProfile?.name ?? null,
      };
    },
  };
}
