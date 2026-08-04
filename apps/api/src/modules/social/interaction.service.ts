/**
 * Likes and comments (FR-SOC-003, 004).
 *
 * Both act on a post, so both start by proving the caller can *see* that post — which is where
 * blocking is enforced. Liking something you have been blocked from is not a permission question
 * with a nicer error; the post is simply not there.
 */
import { assertOwnsResource } from '../../shared/authz/index.js';
import { NotFoundError } from '../../shared/errors/index.js';

import type { CommentRow, InteractionRepository } from './interaction.repository.js';
import type { PostRepository } from './post.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type { CommentResponse, CreateCommentInput, LikeResponse } from '@connected/types';

export interface InteractionService {
  toggleLike: (actor: Actor, postId: string) => Promise<LikeResponse>;
  comment: (actor: Actor, postId: string, input: CreateCommentInput) => Promise<CommentResponse>;
  listComments: (actor: Actor, postId: string) => Promise<{ data: CommentResponse[] }>;
  removeComment: (actor: Actor, commentId: string) => Promise<void>;
}

export interface InteractionServiceDeps {
  repository: InteractionRepository;
  posts: PostRepository;
  storage?: Storage | undefined;
  logger: Logger;
}

export function createInteractionService({
  repository,
  posts,
  storage,
  logger,
}: InteractionServiceDeps): InteractionService {
  async function toResponse(row: CommentRow, actor: Actor): Promise<CommentResponse> {
    return {
      id: row.id,
      postId: row.postId,
      author: {
        accountId: row.accountId,
        accountType: row.authorType,
        displayName: row.authorName,
        handle: row.authorHandle,
        displayPicUrl:
          row.authorPicKey && storage ? await storage.signedUrl(row.authorPicKey) : null,
      },
      body: row.body,
      mine: row.accountId === actor.accountId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Proves the post exists *for this caller*, which is the block check. */
  async function assertPostVisible(actor: Actor, postId: string): Promise<void> {
    const post = await posts.findById(postId, actor.accountId);
    if (!post) throw new NotFoundError();
  }

  return {
    toggleLike: async (actor, postId) => {
      await assertPostVisible(actor, postId);

      const { liked, count } = await repository.toggleLike(postId, actor.accountId);

      return { postId, liked, likeCount: count };
    },

    comment: async (actor, postId, input) => {
      await assertPostVisible(actor, postId);

      const created = await repository.addComment({
        postId,
        accountId: actor.accountId,
        body: input.body,
      });

      logger.info({ postId, commentId: created.id }, 'Comment added');

      return toResponse(created, actor);
    },

    listComments: async (actor, postId) => {
      await assertPostVisible(actor, postId);

      const rows = await repository.listComments(postId, actor.accountId);

      return { data: await Promise.all(rows.map((row) => toResponse(row, actor))) };
    },

    /**
     * Author-only, and read from the row rather than from the visible list: a comment hidden from
     * the caller by a block is still not theirs to delete.
     *
     * The post's author cannot delete comments on it either. That is a real decision and not an
     * oversight — moderating a thread is a moderation feature (S4-8), and letting an author quietly
     * remove criticism is the shape of the thing this product should not build by accident.
     */
    removeComment: async (actor, commentId) => {
      const author = await repository.commentAuthor(commentId);
      if (!author) throw new NotFoundError();

      assertOwnsResource(actor, author);

      await repository.softDeleteComment(commentId);
      logger.info({ commentId, accountId: actor.accountId }, 'Comment deleted');
    },
  };
}
