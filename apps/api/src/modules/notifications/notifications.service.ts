/**
 * Notifications: reading your own, and turning domain events into them.
 *
 * Authorization here is simple and absolute — **a notification is only ever readable by its
 * recipient**. There is no "school reads a member's notifications" case, so every query is scoped
 * by `actor.accountId` rather than taking an id and checking it afterwards. Scoping the query is
 * the version that cannot be forgotten.
 */
import type { NotificationsRepository } from './notifications.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { DomainEvent } from '../../shared/events/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { NotificationCategory, Prisma } from '../../generated/prisma/client.js';

export interface NotificationView {
  id: string;
  type: string;
  payload: unknown;
  read: boolean;
  createdAt: string;
}

export interface NotificationsService {
  list: (
    actor: Actor,
    options?: { unreadOnly?: boolean; limit?: number },
  ) => Promise<{
    data: NotificationView[];
    unreadCount: number;
  }>;
  markRead: (actor: Actor, notificationId: string) => Promise<void>;
  markAllRead: (actor: Actor) => Promise<{ updated: number }>;
  /** Queue consumer entry point. */
  handleEvent: (event: DomainEvent) => Promise<void>;
}

export interface NotificationsServiceDeps {
  repository: NotificationsRepository;
  logger: Logger;
}

const MAX_LIMIT = 100;

export function createNotificationsService({
  repository,
  logger,
}: NotificationsServiceDeps): NotificationsService {
  /** Writes one notification, respecting the recipient's category preference. */
  async function deliver(input: {
    recipientAccountId: string;
    type: string;
    category: NotificationCategory;
    payload: Prisma.InputJsonValue;
    eventId: string;
  }): Promise<void> {
    if (!(await repository.isCategoryEnabled(input.recipientAccountId, input.category))) {
      return;
    }

    const { created } = await repository.create(input);

    // Not an error: a redelivered event is expected under at-least-once, and skipping is the
    // idempotency working rather than something going wrong.
    logger.debug(
      { type: input.type, recipientAccountId: input.recipientAccountId, created },
      created ? 'Notification created' : 'Notification already existed for this event',
    );
  }

  return {
    list: async (actor, { unreadOnly = false, limit = 50 } = {}) => {
      const rows = await repository.listForAccount(actor.accountId, {
        unreadOnly,
        limit: Math.min(Math.max(limit, 1), MAX_LIMIT),
      });

      return {
        data: rows.map((row) => ({
          id: row.id,
          type: row.type,
          payload: row.payload,
          read: row.readAt !== null,
          createdAt: row.createdAt.toISOString(),
        })),
        unreadCount: await repository.countUnread(actor.accountId),
      };
    },

    markRead: async (actor, notificationId) => {
      const updated = await repository.markRead(actor.accountId, notificationId);

      if (!updated) {
        // Already read, or not this person's — indistinguishable on purpose, so the endpoint
        // cannot be used to discover whether a notification id exists.
        const { NotFoundError } = await import('../../shared/errors/index.js');
        throw new NotFoundError();
      }
    },

    markAllRead: async (actor) => ({ updated: await repository.markAllRead(actor.accountId) }),

    /**
     * FR-NOTIF-001. Unknown event types are ignored rather than throwing: a handler that fails on
     * an event it does not care about would retry forever and eventually dead-letter it.
     */
    handleEvent: async (event) => {
      switch (event.type) {
        case 'verification.submitted':
          // The school is an account, so it receives this like anyone else.
          await deliver({
            recipientAccountId: event.schoolId,
            type: 'verification.submitted',
            category: 'VERIFICATION',
            payload: {
              requestId: event.requestId,
              requesterAccountId: event.requesterAccountId,
              role: event.role,
            },
            eventId: event.eventId,
          });
          return;

        case 'verification.decided':
          await deliver({
            recipientAccountId: event.requesterAccountId,
            type: 'verification.decided',
            category: 'VERIFICATION',
            payload: {
              requestId: event.requestId,
              schoolId: event.schoolId,
              role: event.role,
              status: event.status,
            },
            eventId: event.eventId,
          });
          return;

        case 'membership.revoked':
          await deliver({
            recipientAccountId: event.accountId,
            type: 'membership.revoked',
            category: 'VERIFICATION',
            payload: { schoolId: event.schoolId },
            eventId: event.eventId,
          });
          return;

        default:
          return;
      }
    },
  };
}
