/**
 * Threads and messages. **The only file in this pair that touches Prisma.**
 *
 * The inbox is the query to watch. A thread list needs, per thread, the other participant, the last
 * message, and how many are unread — which is three per-thread lookups if written naively, and the
 * same N+1 the class feed hit in Sprint 2. It is three queries in total here, whatever the number
 * of threads.
 */
import {
  CURSOR_ORDER,
  cursorFilter,
  takeFor,
  BOUNDED_LIST_CAP,
} from '../../shared/http/pagination.js';

import type { PageRequest } from '../../shared/http/pagination.js';
import type { Db } from '../../shared/db/index.js';

export interface CardRow {
  accountId: string;
  accountType: 'INDIVIDUAL' | 'SCHOOL';
  displayName: string;
  handle: string | null;
  displayPicKey: string | null;
}

export interface ThreadRow {
  id: string;
  other: CardRow;
  lastMessage: { body: string; senderAccountId: string; createdAt: Date } | null;
  unreadCount: number;
  updatedAt: Date;
}

export interface MessageRow {
  id: string;
  threadId: string;
  senderAccountId: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface MessageRepository {
  findThreadBetween: (x: string, y: string) => Promise<{ id: string } | null>;
  createThread: (a: string, b: string) => Promise<{ id: string }>;
  /** Participants of a thread, or null when it does not exist. */
  participants: (threadId: string) => Promise<{ a: string; b: string } | null>;
  listInbox: (accountId: string) => Promise<ThreadRow[]>;
  listMessages: (threadId: string, page: PageRequest) => Promise<MessageRow[]>;
  send: (input: { threadId: string; senderAccountId: string; body: string }) => Promise<MessageRow>;
  /** Marks everything the *other* party sent as read. Returns how many changed. */
  markRead: (threadId: string, readerAccountId: string) => Promise<number>;
  unreadTotal: (accountId: string) => Promise<number>;
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

/** Threads are stored in a fixed participant order, so a pair has one thread however it started. */
export function orderParticipants(x: string, y: string): { a: string; b: string } {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

export function createMessageRepository(db: Db): MessageRepository {
  return {
    findThreadBetween: async (x, y) => {
      const { a, b } = orderParticipants(x, y);

      return db.messageThread.findUnique({
        where: { participantA_participantB: { participantA: a, participantB: b } },
        select: { id: true },
      });
    },

    createThread: async (a, b) =>
      db.messageThread.create({ data: { participantA: a, participantB: b }, select: { id: true } }),

    participants: async (threadId) => {
      const thread = await db.messageThread.findUnique({
        where: { id: threadId },
        select: { participantA: true, participantB: true },
      });

      return thread ? { a: thread.participantA, b: thread.participantB } : null;
    },

    /**
     * Three queries: the threads, their last messages, their unread counts. Not three *per*
     * thread — the last-message lookup takes every thread id at once and the unread count is a
     * single `groupBy`.
     *
     * Blocked counterparties are excluded here rather than filtered afterwards, so a blocked
     * thread cannot contribute to the unread badge either.
     */
    listInbox: async (accountId) => {
      const threads = await db.messageThread.findMany({
        where: {
          OR: [{ participantA: accountId }, { participantB: accountId }],
          a: {
            blocksMade: { none: { blockedAccountId: accountId } },
            blocksReceived: { none: { blockerAccountId: accountId } },
          },
          b: {
            blocksMade: { none: { blockedAccountId: accountId } },
            blocksReceived: { none: { blockerAccountId: accountId } },
          },
        },
        select: {
          id: true,
          participantA: true,
          participantB: true,
          updatedAt: true,
          a: ACCOUNT_CARD,
          b: ACCOUNT_CARD,
        },
        orderBy: { updatedAt: 'desc' },
        take: BOUNDED_LIST_CAP,
      });

      if (threads.length === 0) return [];

      const ids = threads.map((thread) => thread.id);

      const [latest, unread] = await Promise.all([
        db.message.findMany({
          where: { threadId: { in: ids }, deletedAt: null },
          select: { threadId: true, body: true, senderAccountId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        db.message.groupBy({
          by: ['threadId'],
          where: {
            threadId: { in: ids },
            deletedAt: null,
            readAt: null,
            senderAccountId: { not: accountId },
          },
          _count: { _all: true },
        }),
      ]);

      // First occurrence wins: the list is already newest-first.
      const lastByThread = new Map<string, (typeof latest)[number]>();
      for (const message of latest) {
        if (!lastByThread.has(message.threadId)) lastByThread.set(message.threadId, message);
      }

      const unreadByThread = new Map(unread.map((row) => [row.threadId, row._count._all]));

      return threads.map((thread) => {
        const last = lastByThread.get(thread.id);

        return {
          id: thread.id,
          other: toCard(thread.participantA === accountId ? thread.b : thread.a),
          lastMessage: last
            ? { body: last.body, senderAccountId: last.senderAccountId, createdAt: last.createdAt }
            : null,
          unreadCount: unreadByThread.get(thread.id) ?? 0,
          updatedAt: thread.updatedAt,
        };
      });
    },

    listMessages: async (threadId, page) =>
      db.message.findMany({
        where: { threadId, deletedAt: null, ...cursorFilter(page.after) },
        select: {
          id: true,
          threadId: true,
          senderAccountId: true,
          body: true,
          readAt: true,
          createdAt: true,
        },
        orderBy: [...CURSOR_ORDER],
        take: takeFor(page.limit),
      }),

    send: async ({ threadId, senderAccountId, body }) => {
      const [message] = await db.$transaction([
        db.message.create({
          data: { threadId, senderAccountId, body },
          select: {
            id: true,
            threadId: true,
            senderAccountId: true,
            body: true,
            readAt: true,
            createdAt: true,
          },
        }),
        // Touches the thread so the inbox sorts by activity rather than by when it was created.
        db.messageThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
      ]);

      return message;
    },

    markRead: async (threadId, readerAccountId) => {
      const { count } = await db.message.updateMany({
        // Only the other party's messages, and only the unread ones — so re-opening a thread does
        // not move timestamps that already mean something.
        where: { threadId, senderAccountId: { not: readerAccountId }, readAt: null },
        data: { readAt: new Date() },
      });

      return count;
    },

    /**
     * The badge, and it has to honour blocks for the same reason the list does: a count that keeps
     * pointing at a conversation neither party can open is a permanent unread nobody can clear.
     * The first version of this missed that, and the test named after it is why.
     */
    unreadTotal: async (accountId) =>
      db.message.count({
        where: {
          deletedAt: null,
          readAt: null,
          senderAccountId: { not: accountId },
          thread: {
            OR: [{ participantA: accountId }, { participantB: accountId }],
            a: {
              blocksMade: { none: { blockedAccountId: accountId } },
              blocksReceived: { none: { blockerAccountId: accountId } },
            },
            b: {
              blocksMade: { none: { blockedAccountId: accountId } },
              blocksReceived: { none: { blockerAccountId: accountId } },
            },
          },
        },
      }),
  };
}
