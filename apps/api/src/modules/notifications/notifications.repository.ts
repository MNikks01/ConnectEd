/**
 * Notification persistence. **The only file in this module that touches Prisma.**
 */
import type { Db } from '../../shared/db/index.js';
import type { NotificationCategory, Prisma } from '../../generated/prisma/client.js';

export interface NotificationRow {
  id: string;
  type: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  recipientAccountId: string;
  type: string;
  category: NotificationCategory;
  /** Prisma's own Json input type — `Record<string, unknown>` is not assignable to it. */
  payload: Prisma.InputJsonValue;
  eventId: string;
}

export interface NotificationsRepository {
  create: (input: CreateNotificationInput) => Promise<{ created: boolean }>;
  listForAccount: (
    accountId: string,
    options: { unreadOnly: boolean; limit: number },
  ) => Promise<NotificationRow[]>;
  countUnread: (accountId: string) => Promise<number>;
  markRead: (accountId: string, notificationId: string) => Promise<boolean>;
  markAllRead: (accountId: string) => Promise<number>;
  isCategoryEnabled: (accountId: string, category: NotificationCategory) => Promise<boolean>;
}

export function createNotificationsRepository(db: Db): NotificationsRepository {
  return {
    /**
     * Idempotent by (eventId, recipient). Delivery is at-least-once, so the same event will be
     * handled twice; `createMany` with `skipDuplicates` makes the second attempt a no-op instead
     * of a duplicate in someone's list or an error that retries forever.
     */
    create: async (input) => {
      const result = await db.notification.createMany({
        data: [
          {
            recipientAccountId: input.recipientAccountId,
            type: input.type,
            payload: input.payload,
            eventId: input.eventId,
          },
        ],
        skipDuplicates: true,
      });

      return { created: result.count > 0 };
    },

    listForAccount: (accountId, { unreadOnly, limit }) =>
      db.notification.findMany({
        where: { recipientAccountId: accountId, ...(unreadOnly ? { readAt: null } : {}) },
        select: { id: true, type: true, payload: true, readAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),

    countUnread: (accountId) =>
      db.notification.count({ where: { recipientAccountId: accountId, readAt: null } }),

    /** Scoped to the account, so one person cannot mark another's notification read. */
    markRead: async (accountId, notificationId) => {
      const result = await db.notification.updateMany({
        where: { id: notificationId, recipientAccountId: accountId, readAt: null },
        data: { readAt: new Date() },
      });

      return result.count > 0;
    },

    markAllRead: async (accountId) => {
      const result = await db.notification.updateMany({
        where: { recipientAccountId: accountId, readAt: null },
        data: { readAt: new Date() },
      });

      return result.count;
    },

    /** Absent preference means enabled — opt-out, not opt-in (FR-NOTIF-006). */
    isCategoryEnabled: async (accountId, category) => {
      const preference = await db.notificationPref.findUnique({
        where: { accountId_category: { accountId, category } },
        select: { enabled: true },
      });

      return preference?.enabled ?? true;
    },
  };
}
