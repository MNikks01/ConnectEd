/**
 * Profile reads and writes. **The only file in this module that touches Prisma.**
 */
import type { Db } from '../../shared/db/index.js';
import type { ProfileVisibility } from '../../generated/prisma/client.js';

export interface ProfileRow {
  accountId: string;
  accountType: 'INDIVIDUAL' | 'SCHOOL';
  displayName: string;
  handle: string | null;
  displayPicKey: string | null;
  bio: string | null;
  achievements: string | null;
  role: string | null;
  city: string | null;
  about: string | null;
  visibility: ProfileVisibility;
}

export interface ProfileRepository {
  find: (accountId: string) => Promise<ProfileRow | null>;
  updateUserProfile: (
    accountId: string,
    data: {
      fullName?: string;
      bio?: string | null;
      achievements?: string | null;
      displayPicKey?: string | null;
      visibility?: ProfileVisibility;
    },
  ) => Promise<ProfileRow>;
  /** True when the two accounts have an accepted connection, in either direction. */
  areConnected: (a: string, b: string) => Promise<boolean>;
}

export function createProfileRepository(db: Db): ProfileRepository {
  return {
    /**
     * One query for either kind of account.
     *
     * A school's profile is a profile too (`FR-SOC-001`), and the two live in different tables —
     * so the account row is the way in, and whichever profile hangs off it supplies the fields.
     */
    find: async (accountId) => {
      const account = await db.account.findFirst({
        where: { id: accountId, deletedAt: null },
        select: {
          id: true,
          type: true,
          userProfile: {
            select: {
              fullName: true,
              handle: true,
              displayPicKey: true,
              bio: true,
              achievements: true,
              role: true,
              visibility: true,
            },
          },
          schoolProfile: {
            select: { name: true, displayPicKey: true, about: true, city: true },
          },
        },
      });

      if (!account) return null;

      if (account.userProfile) {
        return {
          accountId: account.id,
          accountType: 'INDIVIDUAL',
          displayName: account.userProfile.fullName,
          handle: account.userProfile.handle,
          displayPicKey: account.userProfile.displayPicKey,
          bio: account.userProfile.bio,
          achievements: account.userProfile.achievements,
          role: account.userProfile.role,
          city: null,
          about: null,
          visibility: account.userProfile.visibility,
        };
      }

      if (account.schoolProfile) {
        return {
          accountId: account.id,
          accountType: 'SCHOOL',
          displayName: account.schoolProfile.name,
          handle: null,
          displayPicKey: account.schoolProfile.displayPicKey,
          bio: null,
          achievements: null,
          role: null,
          city: account.schoolProfile.city,
          about: account.schoolProfile.about,
          // A school is an institution advertising itself; there is nothing to hide behind a
          // setting, and the school portal is where its private data lives.
          visibility: 'PUBLIC',
        };
      }

      // An account with neither profile is mid-registration, not a profile anyone can read.
      return null;
    },

    updateUserProfile: async (accountId, data) => {
      await db.userProfile.update({ where: { accountId }, data });

      const row = await db.account.findUniqueOrThrow({
        where: { id: accountId },
        select: {
          id: true,
          userProfile: {
            select: {
              fullName: true,
              handle: true,
              displayPicKey: true,
              bio: true,
              achievements: true,
              role: true,
              visibility: true,
            },
          },
        },
      });

      const profile = row.userProfile;

      return {
        accountId: row.id,
        accountType: 'INDIVIDUAL',
        displayName: profile?.fullName ?? '',
        handle: profile?.handle ?? null,
        displayPicKey: profile?.displayPicKey ?? null,
        bio: profile?.bio ?? null,
        achievements: profile?.achievements ?? null,
        role: profile?.role ?? null,
        city: null,
        about: null,
        visibility: profile?.visibility ?? 'PUBLIC',
      };
    },

    /**
     * Either direction. The table stores one row per pair with an `a`/`b` ordering that records
     * who asked, not who matters — a connection is mutual once accepted.
     */
    areConnected: async (a, b) => {
      const connection = await db.connection.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { aAccountId: a, bAccountId: b },
            { aAccountId: b, bAccountId: a },
          ],
        },
        select: { id: true },
      });

      return connection !== null;
    },
  };
}
