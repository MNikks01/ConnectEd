/**
 * Direct messages (FR-SOC-020, 021).
 *
 * One-to-one threads, and the only place in social where content is addressed to a *person* rather
 * than published. That changes what blocking has to do: a blocked account must not be able to
 * reach the person who blocked them, and an existing thread with them must leave the inbox.
 *
 * Reading a thread marks the other party's messages read, the same way opening an academic item
 * records a receipt — a "mark as read" button is a button someone forgets to press.
 */
import { NotFoundError } from '../../shared/errors/index.js';
import { toPage } from '../../shared/http/pagination.js';

import type { CardRow, MessageRepository, MessageRow, ThreadRow } from './message.repository.js';
import { orderParticipants } from './message.repository.js';

import type { Actor } from '../../shared/authz/actor.js';
import type { GraphRepository } from './graph.repository.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Page, PageRequest } from '../../shared/http/pagination.js';
import type { Storage } from '../../shared/storage/index.js';
import type { InboxResponse, MessageResponse, ThreadResponse } from '@connected/types';

export interface MessageService {
  /** Finds the thread with that account, or starts one. Idempotent by design. */
  startThread: (actor: Actor, accountId: string) => Promise<ThreadResponse>;
  inbox: (actor: Actor) => Promise<InboxResponse>;
  /** Reading marks the other party's messages read. */
  readThread: (actor: Actor, threadId: string, page: PageRequest) => Promise<Page<MessageResponse>>;
  send: (actor: Actor, threadId: string, body: string) => Promise<MessageResponse>;
}

/**
 * The slice of the realtime channel this module needs.
 *
 * Optional: an API built without Redis still sends messages, and the recipient sees them on their
 * next read. Live delivery is an improvement on polling, never a precondition for it.
 */
export interface MessagePresence {
  publish: (
    accountId: string,
    event: { type: 'message.created'; threadId: string },
  ) => Promise<void>;
}

export interface MessageServiceDeps {
  repository: MessageRepository;
  graph: GraphRepository;
  storage?: Storage | undefined;
  logger: Logger;
  presence?: MessagePresence | undefined;
}

export function createMessageService({
  repository,
  graph,
  storage,
  logger,
  presence,
}: MessageServiceDeps): MessageService {
  async function toCard(card: CardRow) {
    return {
      accountId: card.accountId,
      accountType: card.accountType,
      displayName: card.displayName,
      handle: card.handle,
      displayPicUrl:
        card.displayPicKey && storage ? await storage.signedUrl(card.displayPicKey) : null,
    };
  }

  async function toThread(row: ThreadRow, actor: Actor): Promise<ThreadResponse> {
    return {
      id: row.id,
      other: await toCard(row.other),
      lastMessage: row.lastMessage
        ? {
            body: row.lastMessage.body,
            mine: row.lastMessage.senderAccountId === actor.accountId,
            createdAt: row.lastMessage.createdAt.toISOString(),
          }
        : null,
      unreadCount: row.unreadCount,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  function toMessage(row: MessageRow, actor: Actor): MessageResponse {
    return {
      id: row.id,
      threadId: row.threadId,
      senderAccountId: row.senderAccountId,
      body: row.body,
      mine: row.senderAccountId === actor.accountId,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * The caller is in this thread and neither party has blocked the other.
   *
   * A thread the caller is not part of is a `NotFoundError`, not a forbidden — thread ids are
   * opaque, and confirming one exists tells a stranger something about two other people.
   */
  async function assertParticipant(actor: Actor, threadId: string): Promise<string> {
    const participants = await repository.participants(threadId);
    if (!participants) throw new NotFoundError();

    const other =
      participants.a === actor.accountId
        ? participants.b
        : participants.b === actor.accountId
          ? participants.a
          : undefined;

    if (!other) throw new NotFoundError();
    if (await graph.isBlockedEitherWay(actor.accountId, other)) throw new NotFoundError();

    return other;
  }

  return {
    startThread: async (actor, accountId) => {
      if (accountId === actor.accountId) {
        // Messaging yourself is a notes app, and this is not one.
        throw new NotFoundError();
      }

      if (await graph.isBlockedEitherWay(actor.accountId, accountId)) throw new NotFoundError();

      const existing = await repository.findThreadBetween(actor.accountId, accountId);

      if (!existing) {
        const { a, b } = orderParticipants(actor.accountId, accountId);
        await repository.createThread(a, b);
        logger.info({ accountId: actor.accountId }, 'Thread started');
      }

      // Read back through the inbox so a new thread and an existing one answer identically.
      const inbox = await repository.listInbox(actor.accountId);
      const thread = inbox.find((row) => row.other.accountId === accountId);

      if (!thread) throw new NotFoundError();

      return toThread(thread, actor);
    },

    inbox: async (actor) => {
      const threads = await repository.listInbox(actor.accountId);

      return {
        data: await Promise.all(threads.map((thread) => toThread(thread, actor))),
        // Counted independently of the page, because the badge is about everything unread.
        unreadTotal: await repository.unreadTotal(actor.accountId),
      };
    },

    readThread: async (actor, threadId, page) => {
      await assertParticipant(actor, threadId);

      const rows = await repository.listMessages(threadId, page);
      const paged = toPage(rows, page.limit);

      // After the read, so a failure to mark cannot swallow the messages themselves.
      const marked = await repository.markRead(threadId, actor.accountId);
      if (marked > 0) logger.debug({ threadId, marked }, 'Messages marked read');

      return {
        data: paged.data.map((row) => toMessage(row, actor)),
        nextCursor: paged.nextCursor,
      };
    },

    send: async (actor, threadId, body) => {
      const other = await assertParticipant(actor, threadId);

      const message = await repository.send({
        threadId,
        senderAccountId: actor.accountId,
        body,
      });

      // After the write, and awaited only to keep an unhandled rejection from escaping — the
      // publish swallows its own failures. The recipient is told the thread moved, never what was
      // said: they re-read through an endpoint that checks whether they still may.
      await presence?.publish(other, { type: 'message.created', threadId });

      return toMessage(message, actor);
    },
  };
}
