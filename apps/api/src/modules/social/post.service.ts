/**
 * Posts (FR-SOC-002, 004).
 *
 * Open to every account, like the rest of social. The checks that matter are **ownership** — only
 * the author edits or deletes — and **blocking**, which the repository applies to every read in
 * one place rather than at each call site.
 *
 * Delete is soft: `PRD/06-social.md` requires content to survive for retention and moderation, and
 * a report about a post someone deleted is the case that most needs the post.
 */
import { assertOwnsResource } from '../../shared/authz/index.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { toPage } from '../../shared/http/pagination.js';

import type { PostRepository, PostRow } from './post.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Page, PageRequest } from '../../shared/http/pagination.js';
import type { Storage } from '../../shared/storage/index.js';
import type { CreatePostInput, PostResponse, UpdatePostInput } from '@connected/types';

export interface PostService {
  create: (actor: Actor, input: CreatePostInput) => Promise<PostResponse>;
  get: (actor: Actor, postId: string) => Promise<PostResponse>;
  listTimeline: (actor: Actor, accountId: string, page: PageRequest) => Promise<Page<PostResponse>>;
  /** Reverse-chronological, from follows and connections (FR-SOC-012). */
  listFeed: (actor: Actor, page: PageRequest) => Promise<Page<PostResponse>>;
  update: (actor: Actor, postId: string, input: UpdatePostInput) => Promise<PostResponse>;
  remove: (actor: Actor, postId: string) => Promise<void>;
}

export interface PostServiceDeps {
  repository: PostRepository;
  storage?: Storage | undefined;
  logger: Logger;
  media?: { claim: (key: string) => Promise<void> } | undefined;
}

export function createPostService({
  repository,
  storage,
  logger,
  media,
}: PostServiceDeps): PostService {
  async function toResponse(row: PostRow, actor: Actor): Promise<PostResponse> {
    return {
      id: row.id,
      author: {
        accountId: row.authorAccountId,
        accountType: row.authorType,
        displayName: row.authorName,
        handle: row.authorHandle,
        displayPicUrl:
          row.authorPicKey && storage ? await storage.signedUrl(row.authorPicKey) : null,
      },
      body: row.body,
      imageUrl: row.imageKey && storage ? await storage.signedUrl(row.imageKey) : null,
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      liked: row.likedByCaller,
      mine: row.authorAccountId === actor.accountId,
      createdAt: row.createdAt.toISOString(),
      // Only when it actually changed: `updatedAt` moves on every write, including the first.
      editedAt:
        row.updatedAt.getTime() === row.createdAt.getTime() ? null : row.updatedAt.toISOString(),
    };
  }

  /** Loads a post the caller may see. A blocked author's post is missing, not forbidden. */
  async function loadVisible(actor: Actor, postId: string): Promise<PostRow> {
    const post = await repository.findById(postId, actor.accountId);
    if (!post) throw new NotFoundError();

    return post;
  }

  return {
    create: async (actor, input) => {
      if (input.imageKey) await media?.claim(input.imageKey);

      const id = await repository.create({
        authorAccountId: actor.accountId,
        body: input.body,
        ...(input.imageKey ? { imageKey: input.imageKey } : {}),
      });

      logger.info({ postId: id, accountId: actor.accountId }, 'Post published');

      return toResponse(await loadVisible(actor, id), actor);
    },

    get: async (actor, postId) => toResponse(await loadVisible(actor, postId), actor),

    listTimeline: async (actor, accountId, page) => {
      const rows = await repository.listByAuthor(accountId, actor.accountId, page);
      const paged = toPage(rows, page.limit);

      return {
        data: await Promise.all(paged.data.map((row) => toResponse(row, actor))),
        nextCursor: paged.nextCursor,
      };
    },

    listFeed: async (actor, page) => {
      const rows = await repository.listFeed(actor.accountId, page);
      const paged = toPage(rows, page.limit);

      return {
        data: await Promise.all(paged.data.map((row) => toResponse(row, actor))),
        nextCursor: paged.nextCursor,
      };
    },

    update: async (actor, postId, input) => {
      // Ownership is read from the row, not from what the caller can see: a post hidden by a block
      // is still not theirs to edit, and answering differently would confirm it exists.
      const author = await repository.authorOf(postId);
      if (!author) throw new NotFoundError();

      assertOwnsResource(actor, author);

      if (input.imageKey) await media?.claim(input.imageKey);

      await repository.update(postId, {
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(input.imageKey === undefined ? {} : { imageKey: input.imageKey ?? null }),
      });

      return toResponse(await loadVisible(actor, postId), actor);
    },

    remove: async (actor, postId) => {
      const author = await repository.authorOf(postId);
      if (!author) throw new NotFoundError();

      assertOwnsResource(actor, author);

      await repository.softDelete(postId);
      logger.info({ postId, accountId: actor.accountId }, 'Post deleted');
    },
  };
}
