/**
 * Post persistence. **The only file in this pair that touches Prisma.**
 *
 * Every read here goes through `visibleTo`, which is the single place blocking is applied. That is
 * deliberate and worth keeping: a block that is honoured by the timeline but not by the feed, or
 * by the feed but not by a comment list, is not a block. One helper, used by every query, is the
 * only version that stays true as queries are added.
 */
import { CURSOR_ORDER, cursorFilter, takeFor } from '../../shared/http/pagination.js';

import type { PageRequest } from '../../shared/http/pagination.js';
import type { Db } from '../../shared/db/index.js';
import type { Prisma } from '../../generated/prisma/client.js';

export interface PostRow {
  id: string;
  authorAccountId: string;
  authorName: string;
  authorHandle: string | null;
  authorPicKey: string | null;
  authorType: 'INDIVIDUAL' | 'SCHOOL';
  body: string;
  imageKey: string | null;
  likeCount: number;
  commentCount: number;
  likedByCaller: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostRepository {
  create: (input: {
    authorAccountId: string;
    body: string;
    imageKey?: string | undefined;
  }) => Promise<string>;
  /** One post, or null when it is deleted, missing, or hidden from this caller by a block. */
  findById: (id: string, callerAccountId: string) => Promise<PostRow | null>;
  /** An account's own timeline, as seen by the caller. */
  listByAuthor: (
    authorAccountId: string,
    callerAccountId: string,
    page: PageRequest,
  ) => Promise<PostRow[]>;
  update: (id: string, data: { body?: string; imageKey?: string | null }) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  /** Author of a post regardless of blocks — ownership checks must not depend on visibility. */
  authorOf: (id: string) => Promise<string | null>;
  /** The caller's feed: their own posts, plus everyone they follow or are connected to. */
  listFeed: (callerAccountId: string, page: PageRequest) => Promise<PostRow[]>;
}

const SELECT = {
  id: true,
  authorAccountId: true,
  body: true,
  imageKey: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      type: true,
      userProfile: { select: { fullName: true, handle: true, displayPicKey: true } },
      schoolProfile: { select: { name: true, displayPicKey: true } },
    },
  },
  _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
} as const;

interface RawPost {
  id: string;
  authorAccountId: string;
  body: string;
  imageKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    type: string;
    userProfile: { fullName: string; handle: string; displayPicKey: string | null } | null;
    schoolProfile: { name: string; displayPicKey: string | null } | null;
  } | null;
  _count: { likes: number; comments: number };
  likes?: { id: string }[];
}

function toRow(raw: RawPost): PostRow {
  const individual = raw.author?.userProfile;
  const school = raw.author?.schoolProfile;

  return {
    id: raw.id,
    authorAccountId: raw.authorAccountId,
    authorName: individual?.fullName ?? school?.name ?? 'Someone',
    authorHandle: individual?.handle ?? null,
    authorPicKey: individual?.displayPicKey ?? school?.displayPicKey ?? null,
    authorType: raw.author?.type === 'SCHOOL' ? 'SCHOOL' : 'INDIVIDUAL',
    body: raw.body,
    imageKey: raw.imageKey,
    likeCount: raw._count.likes,
    commentCount: raw._count.comments,
    likedByCaller: (raw.likes?.length ?? 0) > 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function createPostRepository(db: Db): PostRepository {
  /**
   * The visibility filter every read shares: not deleted, and not written by anyone in a blocking
   * relationship with the caller — in **either** direction.
   */
  function visibleTo(callerAccountId: string): Prisma.PostWhereInput {
    return {
      deletedAt: null,
      author: {
        blocksMade: { none: { blockedAccountId: callerAccountId } },
        blocksReceived: { none: { blockerAccountId: callerAccountId } },
      },
    };
  }

  /** Whether the caller has liked each post, without a query per row. */
  function callerLike(callerAccountId: string) {
    return { where: { accountId: callerAccountId }, select: { id: true }, take: 1 } as const;
  }

  return {
    create: async ({ authorAccountId, body, imageKey }) => {
      const post = await db.post.create({
        data: { authorAccountId, body, ...(imageKey ? { imageKey } : {}) },
        select: { id: true },
      });

      return post.id;
    },

    findById: async (id, callerAccountId) => {
      const row = await db.post.findFirst({
        where: { id, ...visibleTo(callerAccountId) },
        select: { ...SELECT, likes: callerLike(callerAccountId) },
      });

      return row ? toRow(row) : null;
    },

    listByAuthor: async (authorAccountId, callerAccountId, page) => {
      const rows = await db.post.findMany({
        where: { authorAccountId, ...visibleTo(callerAccountId), ...cursorFilter(page.after) },
        select: { ...SELECT, likes: callerLike(callerAccountId) },
        orderBy: [...CURSOR_ORDER],
        take: takeFor(page.limit),
      });

      return rows.map(toRow);
    },

    /**
     * **One query, not one per followed account.**
     *
     * The relationship tests are expressed as `EXISTS` subqueries rather than by fetching the
     * follow and connection ids first and passing them in an `IN` list. Materialising ids reads
     * more simply and is the version that stops working: it needs its own pagination once someone
     * follows more accounts than the cap, and silently truncates the feed when they do.
     */
    listFeed: async (callerAccountId, page) => {
      const rows = await db.post.findMany({
        where: {
          ...visibleTo(callerAccountId),
          OR: [
            // Your own posts. The PRD says follows and connections; a feed that hides what you
            // just wrote reads as a bug to everyone who has used any other product.
            { authorAccountId: callerAccountId },
            { author: { followers: { some: { followerAccountId: callerAccountId } } } },
            {
              author: {
                connectionsInitiated: { some: { bAccountId: callerAccountId, status: 'ACCEPTED' } },
              },
            },
            {
              author: {
                connectionsReceived: { some: { aAccountId: callerAccountId, status: 'ACCEPTED' } },
              },
            },
          ],
          ...cursorFilter(page.after),
        },
        select: { ...SELECT, likes: callerLike(callerAccountId) },
        orderBy: [...CURSOR_ORDER],
        take: takeFor(page.limit),
      });

      return rows.map(toRow);
    },

    update: async (id, data) => {
      await db.post.update({
        where: { id },
        data: {
          ...(data.body === undefined ? {} : { body: data.body }),
          ...(data.imageKey === undefined ? {} : { imageKey: data.imageKey }),
        },
      });
    },

    softDelete: async (id) => {
      await db.post.update({ where: { id }, data: { deletedAt: new Date() } });
    },

    authorOf: async (id) =>
      (
        await db.post.findFirst({
          where: { id, deletedAt: null },
          select: { authorAccountId: true },
        })
      )?.authorAccountId ?? null,
  };
}
