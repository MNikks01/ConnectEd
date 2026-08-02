/**
 * Follows and connections. **The only file in this pair that touches Prisma.**
 *
 * A follow is directional and needs no consent. A connection is mutual and needs both — which is
 * why one is a row you create and the other is a row that changes state.
 */
import { BOUNDED_LIST_CAP } from '../../shared/http/pagination.js';

import type { Db } from '../../shared/db/index.js';
import type { ConnectionStatus } from '../../generated/prisma/client.js';

export interface CardRow {
  accountId: string;
  accountType: 'INDIVIDUAL' | 'SCHOOL';
  displayName: string;
  handle: string | null;
  displayPicKey: string | null;
}

export interface ConnectionRow {
  id: string;
  status: ConnectionStatus;
  aAccountId: string;
  bAccountId: string;
  requestedBy: string;
  other: CardRow;
  createdAt: Date;
}

export interface GraphRepository {
  follow: (followerAccountId: string, followeeAccountId: string) => Promise<void>;
  unfollow: (followerAccountId: string, followeeAccountId: string) => Promise<void>;
  isFollowing: (followerAccountId: string, followeeAccountId: string) => Promise<boolean>;
  followCounts: (accountId: string) => Promise<{ followers: number; following: number }>;
  /** Ids only — the feed asks for this and does not need profiles. */
  followeeIds: (accountId: string) => Promise<string[]>;

  findConnection: (a: string, b: string) => Promise<ConnectionRow | null>;
  findConnectionById: (id: string, viewerAccountId: string) => Promise<ConnectionRow | null>;
  createConnection: (input: {
    a: string;
    b: string;
    requestedBy: string;
  }) => Promise<ConnectionRow>;
  acceptConnection: (id: string) => Promise<ConnectionRow>;
  deleteConnection: (id: string) => Promise<void>;
  listConnections: (
    accountId: string,
    status: ConnectionStatus | undefined,
  ) => Promise<ConnectionRow[]>;
  /** Accepted counterparties — the other half of what the feed reads. */
  connectedIds: (accountId: string) => Promise<string[]>;

  /** True when either account has blocked the other. */
  isBlockedEitherWay: (a: string, b: string) => Promise<boolean>;
}

const ACCOUNT_CARD = {
  select: {
    id: true,
    type: true,
    userProfile: { select: { fullName: true, handle: true, displayPicKey: true } },
    schoolProfile: { select: { name: true, displayPicKey: true } },
  },
} as const;

interface RawAccount {
  id: string;
  type: string;
  userProfile: { fullName: string; handle: string; displayPicKey: string | null } | null;
  schoolProfile: { name: string; displayPicKey: string | null } | null;
}

function toCard(raw: RawAccount): CardRow {
  return {
    accountId: raw.id,
    accountType: raw.type === 'SCHOOL' ? 'SCHOOL' : 'INDIVIDUAL',
    displayName: raw.userProfile?.fullName ?? raw.schoolProfile?.name ?? 'Someone',
    handle: raw.userProfile?.handle ?? null,
    displayPicKey: raw.userProfile?.displayPicKey ?? raw.schoolProfile?.displayPicKey ?? null,
  };
}

interface RawConnection {
  id: string;
  status: ConnectionStatus;
  aAccountId: string;
  bAccountId: string;
  requestedBy: string;
  createdAt: Date;
  a: RawAccount;
  b: RawAccount;
}

/**
 * The pair is stored in a fixed order so that `(a, b)` is unique for the *pair*, not for the
 * direction. Without this, A→B and B→A would be two rows and both could sit pending, which is how
 * a connection ends up half-accepted in two places.
 */
export function orderPair(x: string, y: string): { a: string; b: string } {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

function toConnection(raw: RawConnection, viewerAccountId: string): ConnectionRow {
  const other = raw.aAccountId === viewerAccountId ? raw.b : raw.a;

  return {
    id: raw.id,
    status: raw.status,
    aAccountId: raw.aAccountId,
    bAccountId: raw.bAccountId,
    requestedBy: raw.requestedBy,
    other: toCard(other),
    createdAt: raw.createdAt,
  };
}

const CONNECTION_SELECT = {
  id: true,
  status: true,
  aAccountId: true,
  bAccountId: true,
  requestedBy: true,
  createdAt: true,
  a: ACCOUNT_CARD,
  b: ACCOUNT_CARD,
} as const;

export function createGraphRepository(db: Db): GraphRepository {
  return {
    follow: async (followerAccountId, followeeAccountId) => {
      // Idempotent: following twice is the same as following once, and should not be an error the
      // client has to special-case.
      await db.follow.upsert({
        where: { followerAccountId_followeeAccountId: { followerAccountId, followeeAccountId } },
        update: {},
        create: { followerAccountId, followeeAccountId },
      });
    },

    unfollow: async (followerAccountId, followeeAccountId) => {
      await db.follow.deleteMany({ where: { followerAccountId, followeeAccountId } });
    },

    isFollowing: async (followerAccountId, followeeAccountId) =>
      (await db.follow.count({ where: { followerAccountId, followeeAccountId } })) > 0,

    followCounts: async (accountId) => ({
      followers: await db.follow.count({ where: { followeeAccountId: accountId } }),
      following: await db.follow.count({ where: { followerAccountId: accountId } }),
    }),

    followeeIds: async (accountId) =>
      (
        await db.follow.findMany({
          where: { followerAccountId: accountId },
          select: { followeeAccountId: true },
          take: BOUNDED_LIST_CAP,
        })
      ).map((row) => row.followeeAccountId),

    findConnection: async (x, y) => {
      const { a, b } = orderPair(x, y);

      const row = await db.connection.findUnique({
        where: { aAccountId_bAccountId: { aAccountId: a, bAccountId: b } },
        select: CONNECTION_SELECT,
      });

      return row ? toConnection(row, x) : null;
    },

    findConnectionById: async (id, viewerAccountId) => {
      const row = await db.connection.findUnique({ where: { id }, select: CONNECTION_SELECT });
      return row ? toConnection(row, viewerAccountId) : null;
    },

    createConnection: async ({ a, b, requestedBy }) =>
      toConnection(
        await db.connection.create({
          data: { aAccountId: a, bAccountId: b, requestedBy },
          select: CONNECTION_SELECT,
        }),
        requestedBy,
      ),

    acceptConnection: async (id) => {
      const row = await db.connection.update({
        where: { id },
        data: { status: 'ACCEPTED' },
        select: CONNECTION_SELECT,
      });

      return toConnection(row, row.requestedBy);
    },

    deleteConnection: async (id) => {
      await db.connection.delete({ where: { id } });
    },

    listConnections: async (accountId, status) => {
      const rows = await db.connection.findMany({
        where: {
          OR: [{ aAccountId: accountId }, { bAccountId: accountId }],
          ...(status ? { status } : {}),
        },
        select: CONNECTION_SELECT,
        orderBy: { createdAt: 'desc' },
        take: BOUNDED_LIST_CAP,
      });

      return rows.map((row) => toConnection(row, accountId));
    },

    connectedIds: async (accountId) => {
      const rows = await db.connection.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ aAccountId: accountId }, { bAccountId: accountId }],
        },
        select: { aAccountId: true, bAccountId: true },
        take: BOUNDED_LIST_CAP,
      });

      return rows.map((row) => (row.aAccountId === accountId ? row.bAccountId : row.aAccountId));
    },

    isBlockedEitherWay: async (a, b) =>
      (await db.block.count({
        where: {
          OR: [
            { blockerAccountId: a, blockedAccountId: b },
            { blockerAccountId: b, blockedAccountId: a },
          ],
        },
      })) > 0,
  };
}
