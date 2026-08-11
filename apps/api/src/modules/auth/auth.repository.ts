/**
 * Auth persistence. **The only file in this module that touches Prisma** (`apps/api/CLAUDE.md`
 * rule 1) — the service depends on this interface, not on the client.
 */
import { recordAccountActive, recordProductEvent } from '../../shared/analytics/product-events.js';

import type { Db } from '../../shared/db/index.js';
import type { LoginThrottle } from '../../generated/prisma/client.js';

export interface TwoFactorRow {
  secret: string;
  confirmedAt: Date | null;
}
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
  findTwoFactor: (accountId: string) => Promise<TwoFactorRow | null>;
  /** Replaces any unconfirmed enrolment. Re-enrolling before confirming is a retry, not a second factor. */
  startTwoFactorEnrolment: (accountId: string, sealedSecret: string) => Promise<void>;
  /** Confirms the enrolment and stores the hashed recovery codes, in one transaction. */
  confirmTwoFactor: (accountId: string, codeHashes: string[]) => Promise<void>;
  disableTwoFactor: (accountId: string) => Promise<void>;
  /** Spends a recovery code. False when it is unknown or already used. */
  consumeRecoveryCode: (accountId: string, codeHash: string) => Promise<boolean>;
  createTwoFactorChallenge: (input: {
    accountId: string;
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<void>;
  /** Spends a challenge and returns whose it was, or null when it is unusable. */
  consumeTwoFactorChallenge: (tokenHash: string, now: Date) => Promise<string | null>;
  /** Reads the throttle for an address hash. Null when it has no recent failures. */
  findLoginThrottle: (emailHash: string) => Promise<LoginThrottle | null>;
  /** Records a failure and returns the resulting state, so the caller can decide the backoff. */
  recordLoginFailure: (emailHash: string, blockedUntil: Date | null) => Promise<LoginThrottle>;
  /** Forgets an address's failures. Called on every success. */
  clearLoginThrottle: (emailHash: string) => Promise<void>;
  /** Housekeeping: drops rows nothing is throttling any more. Returns how many. */
  sweepLoginThrottles: (before: Date) => Promise<number>;
  /** The account behind an address, or null. Never distinguishes "no account" from anything else. */
  findAccountIdByEmail: (email: string) => Promise<string | null>;
  createPasswordResetToken: (input: {
    accountId: string;
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<void>;
  /**
   * Spends a reset token and applies the new password, in one transaction: the token is marked
   * used, every other outstanding token for that account is invalidated, the credential is
   * replaced, and every refresh-token family is revoked.
   *
   * Returns false when the token was unknown, expired, or already spent — the caller cannot tell
   * which, and neither can the person holding it.
   */
  consumePasswordResetToken: (input: {
    tokenHash: string;
    passwordHash: string;
    algo: string;
    now: Date;
  }) => Promise<boolean>;
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
  isPlatformAdmin: boolean;
  twoFactorEnabled: boolean;
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
    /**
     * A school, its profile, its trial, and the activation funnel's first step — one transaction,
     * because a school that exists without an onboarding event is a hole in every later cohort.
     */
    createSchool: async (input: CreateSchoolInput) =>
      db.$transaction(async (tx) => {
        const account = await tx.account.create({
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
        });

        await recordProductEvent(tx, {
          type: 'school.onboarded',
          accountId: account.id,
          schoolId: account.id,
        });

        return account;
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

    /**
     * The session write, and the activity stamp that rides with it (S9-15).
     *
     * One transaction because they are one fact: a session was issued to this account, today. If
     * the stamp could fail on its own the north-star metric would undercount silently, which is
     * the failure mode of every analytics pipeline that treats its writes as best-effort.
     *
     * `recordAccountActive` is deduped per account per UTC day, so this costs one extra insert on
     * a first sign-in and a no-op on the ninety-six refreshes that follow it.
     */
    storeRefreshToken: async (input: StoreRefreshTokenInput) => {
      await db.$transaction(async (tx) => {
        await tx.refreshToken.create({ data: input });
        await recordAccountActive(tx, input.accountId);
      });
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

    findTwoFactor: (accountId) =>
      db.twoFactorSecret.findUnique({
        where: { accountId },
        select: { secret: true, confirmedAt: true },
      }),

    startTwoFactorEnrolment: async (accountId, sealedSecret) => {
      await db.$transaction([
        // Any recovery codes from a previous enrolment go with it: codes that outlive the secret
        // they belong to are a second factor nobody is tracking.
        db.recoveryCode.deleteMany({ where: { accountId } }),
        db.twoFactorSecret.upsert({
          where: { accountId },
          update: { secret: sealedSecret, confirmedAt: null },
          create: { accountId, secret: sealedSecret },
        }),
      ]);
    },

    confirmTwoFactor: async (accountId, codeHashes) => {
      await db.$transaction([
        db.twoFactorSecret.update({ where: { accountId }, data: { confirmedAt: new Date() } }),
        db.recoveryCode.createMany({
          data: codeHashes.map((codeHash) => ({ accountId, codeHash })),
        }),
      ]);
    },

    disableTwoFactor: async (accountId) => {
      // The codes cascade with the secret, but deleting them explicitly says so at this level
      // rather than relying on a foreign key nobody reads.
      await db.$transaction([
        db.recoveryCode.deleteMany({ where: { accountId } }),
        db.twoFactorSecret.deleteMany({ where: { accountId } }),
      ]);
    },

    consumeRecoveryCode: async (accountId, codeHash) => {
      // The `where` carries every condition, so two requests racing on one code cannot both win.
      const spent = await db.recoveryCode.updateMany({
        where: { accountId, codeHash, usedAt: null },
        data: { usedAt: new Date() },
      });

      return spent.count > 0;
    },

    createTwoFactorChallenge: async ({ accountId, tokenHash, expiresAt }) => {
      await db.twoFactorChallenge.create({ data: { accountId, tokenHash, expiresAt } });
    },

    consumeTwoFactorChallenge: async (tokenHash, now) => {
      const spent = await db.twoFactorChallenge.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });

      if (spent.count === 0) return null;

      const challenge = await db.twoFactorChallenge.findUniqueOrThrow({
        where: { tokenHash },
        select: { accountId: true },
      });

      return challenge.accountId;
    },

    findLoginThrottle: (emailHash) => db.loginThrottle.findUnique({ where: { emailHash } }),

    recordLoginFailure: (emailHash, blockedUntil) =>
      db.loginThrottle.upsert({
        where: { emailHash },
        // `increment` rather than read-then-write: two failed attempts arriving together should
        // count as two, and this is the one path an attacker controls the rate of.
        update: {
          failedCount: { increment: 1 },
          lastFailedAt: new Date(),
          ...(blockedUntil ? { blockedUntil } : {}),
        },
        create: { emailHash, failedCount: 1, ...(blockedUntil ? { blockedUntil } : {}) },
      }),

    clearLoginThrottle: async (emailHash) => {
      await db.loginThrottle.deleteMany({ where: { emailHash } });
    },

    sweepLoginThrottles: async (before) => {
      const result = await db.loginThrottle.deleteMany({ where: { lastFailedAt: { lt: before } } });
      return result.count;
    },

    findAccountIdByEmail: async (email) => {
      const account = await db.account.findUnique({ where: { email }, select: { id: true } });
      return account?.id ?? null;
    },

    createPasswordResetToken: async ({ accountId, tokenHash, expiresAt }) => {
      await db.passwordResetToken.create({ data: { accountId, tokenHash, expiresAt } });
    },

    consumePasswordResetToken: async ({ tokenHash, passwordHash, algo, now }) => {
      return db.$transaction(async (tx) => {
        // The `where` carries every condition, so the update itself is the check: two requests
        // racing with the same token cannot both find it unspent, because only one `updateMany`
        // can match a row whose `usedAt` is still null.
        const spent = await tx.passwordResetToken.updateMany({
          where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });

        if (spent.count === 0) return false;

        const token = await tx.passwordResetToken.findUniqueOrThrow({
          where: { tokenHash },
          select: { accountId: true },
        });

        // Any other link that was in flight — an impatient second request, or a first one an
        // attacker intercepted — dies with this one.
        await tx.passwordResetToken.updateMany({
          where: { accountId: token.accountId, usedAt: null },
          data: { usedAt: now },
        });

        await tx.credential.update({
          where: { accountId: token.accountId },
          data: { passwordHash, algo },
        });

        // Every session, everywhere. Somebody resetting a password may be doing it *because*
        // someone else is in their account, and leaving that session alive defeats the point.
        await tx.refreshToken.updateMany({
          where: { accountId: token.accountId, revokedAt: null },
          data: { revokedAt: now },
        });

        return true;
      });
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
          isPlatformAdmin: true,
          twoFactorSecret: { select: { confirmedAt: true } },
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
        isPlatformAdmin: account.isPlatformAdmin,
        // An *unconfirmed* enrolment is not two-factor: it exists, and it protects nothing yet.
        twoFactorEnabled:
          account.twoFactorSecret?.confirmedAt !== null &&
          account.twoFactorSecret?.confirmedAt !== undefined,
        role: account.userProfile?.role ?? null,
        fullName: account.userProfile?.fullName ?? null,
        handle: account.userProfile?.handle ?? null,
        schoolName: account.schoolProfile?.name ?? null,
      };
    },
  };
}
