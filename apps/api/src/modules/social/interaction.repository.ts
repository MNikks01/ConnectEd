/**
 * Likes and comments. **The only file in this pair that touches Prisma.**
 *
 * Both go through the same block filter posts use. A comment from someone you blocked, sitting
 * under a post you can see, is exactly the gap that makes blocking feel broken.
 */
import { BOUNDED_LIST_CAP } from '../../shared/http/pagination.js';

import type { Db } from '../../shared/db/index.js';
import type { Prisma } from '../../generated/prisma/client.js';

export interface CommentRow {
  id: string;
  postId: string;
  accountId: string;
  authorName: string;
  authorHandle: string | null;
  authorPicKey: string | null;
  authorType: 'INDIVIDUAL' | 'SCHOOL';
  body: string;
  createdAt: Date;
}

export interface InteractionRepository {
  /** Adds a like if absent, removes it if present. Returns the state afterwards. */
  toggleLike: (postId: string, accountId: string) => Promise<{ liked: boolean; count: number }>;
  addComment: (input: { postId: string; accountId: string; body: string }) => Promise<CommentRow>;
  listComments: (postId: string, callerAccountId: string) => Promise<CommentRow[]>;
  commentAuthor: (commentId: string) => Promise<string | null>;
  softDeleteComment: (commentId: string) => Promise<void>;
}

const COMMENT_SELECT = {
  id: true,
  postId: true,
  accountId: true,
  body: true,
  createdAt: true,
  account: {
    select: {
      type: true,
      userProfile: { select: { fullName: true, handle: true, displayPicKey: true } },
      schoolProfile: { select: { name: true, displayPicKey: true } },
    },
  },
} as const;

interface RawComment {
  id: string;
  postId: string;
  accountId: string;
  body: string;
  createdAt: Date;
  account: {
    type: string;
    userProfile: { fullName: string; handle: string; displayPicKey: string | null } | null;
    schoolProfile: { name: string; displayPicKey: string | null } | null;
  } | null;
}

function toRow(raw: RawComment): CommentRow {
  const individual = raw.account?.userProfile;
  const school = raw.account?.schoolProfile;

  return {
    id: raw.id,
    postId: raw.postId,
    accountId: raw.accountId,
    authorName: individual?.fullName ?? school?.name ?? 'Someone',
    authorHandle: individual?.handle ?? null,
    authorPicKey: individual?.displayPicKey ?? school?.displayPicKey ?? null,
    authorType: raw.account?.type === 'SCHOOL' ? 'SCHOOL' : 'INDIVIDUAL',
    body: raw.body,
    createdAt: raw.createdAt,
  };
}

export function createInteractionRepository(db: Db): InteractionRepository {
  /** The same rule the post repository applies, expressed against a comment's author. */
  function visibleTo(callerAccountId: string): Prisma.PostCommentWhereInput {
    return {
      deletedAt: null,
      account: {
        blocksMade: { none: { blockedAccountId: callerAccountId } },
        blocksReceived: { none: { blockerAccountId: callerAccountId } },
      },
    };
  }

  return {
    /**
     * A toggle, not an increment.
     *
     * The `(post_id, account_id)` unique constraint is what makes "one like per member" true even
     * if two requests race — one of them loses the insert rather than both counting.
     */
    toggleLike: async (postId, accountId) => {
      const existing = await db.postLike.findUnique({
        where: { postId_accountId: { postId, accountId } },
        select: { id: true },
      });

      if (existing) {
        await db.postLike.delete({ where: { id: existing.id } });
      } else {
        await db.postLike.create({ data: { postId, accountId } });
      }

      return {
        liked: existing === null,
        count: await db.postLike.count({ where: { postId } }),
      };
    },

    addComment: async ({ postId, accountId, body }) =>
      toRow(
        await db.postComment.create({ data: { postId, accountId, body }, select: COMMENT_SELECT }),
      ),

    listComments: async (postId, callerAccountId) => {
      const rows = await db.postComment.findMany({
        where: { postId, ...visibleTo(callerAccountId) },
        select: COMMENT_SELECT,
        // Chronological (FR-SOC-003): a conversation reads forwards.
        orderBy: { createdAt: 'asc' },
        take: BOUNDED_LIST_CAP,
      });

      return rows.map(toRow);
    },

    commentAuthor: async (commentId) =>
      (
        await db.postComment.findFirst({
          where: { id: commentId, deletedAt: null },
          select: { accountId: true },
        })
      )?.accountId ?? null,

    softDeleteComment: async (commentId) => {
      await db.postComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    },
  };
}
