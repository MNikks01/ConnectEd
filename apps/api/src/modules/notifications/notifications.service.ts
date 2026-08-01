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
import { toPage } from '../../shared/http/pagination.js';

import type { Page, PageRequest } from '../../shared/http/pagination.js';
import type { Logger } from '../../shared/logger/index.js';
import type { NotificationCategory, Prisma } from '../../generated/prisma/client.js';
import type { NotificationResponse } from '@connected/types';

/** The wire shape lives in `@connected/types` so the portal cannot drift from it. */
export type NotificationView = NotificationResponse;

export interface NotificationsService {
  list: (
    actor: Actor,
    options: { unreadOnly: boolean; page: PageRequest },
  ) => Promise<Page<NotificationView> & { unreadCount: number }>;
  markRead: (actor: Actor, notificationId: string) => Promise<void>;
  markAllRead: (actor: Actor) => Promise<{ updated: number }>;
  /** Queue consumer entry point. */
  handleEvent: (event: DomainEvent) => Promise<void>;
}

/**
 * The slice of verification this module needs. Membership belongs to that module, so recipients
 * are asked for rather than queried (`.docs/Architecture/01-modules.md` rule 1).
 */
export interface MemberAudience {
  listClassMemberAccountIds: (classId: string) => Promise<string[]>;
  /** Everyone verified at the school — the audience a notice or an event addresses. */
  listSchoolMemberAccountIds: (schoolId: string) => Promise<string[]>;
}

export interface NotificationsServiceDeps {
  repository: NotificationsRepository;
  logger: Logger;
  /** Absent when the app is built without the verification module; class fan-out is then skipped. */
  audience?: MemberAudience | undefined;
}

export function createNotificationsService({
  repository,
  logger,
  audience,
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

  /**
   * One event, many recipients. The reason the notification uniqueness constraint had to be
   * `(event_id, recipient_id)`: every row here shares one event id, so a globally unique one
   * would have delivered to exactly one person.
   */
  async function fanOut(input: {
    recipients: string[];
    exclude?: string;
    type: string;
    category: NotificationCategory;
    payload: Prisma.InputJsonValue;
    eventId: string;
  }): Promise<number> {
    const others = input.recipients.filter((id) => id !== input.exclude);

    for (const recipientAccountId of others) {
      await deliver({
        recipientAccountId,
        type: input.type,
        category: input.category,
        payload: input.payload,
        eventId: input.eventId,
      });
    }

    return others.length;
  }

  return {
    list: async (actor, { unreadOnly, page }) => {
      const rows = await repository.listForAccount(actor.accountId, { unreadOnly, page });

      // Paginate over the rows, then map — the cursor is built from the row's own sort key, so
      // the view type never has to carry a Date it does not otherwise need.
      const paged = toPage(rows, page.limit);

      return {
        data: paged.data.map((row) => ({
          id: row.id,
          type: row.type,
          payload: row.payload,
          read: row.readAt !== null,
          createdAt: row.createdAt.toISOString(),
        })),
        nextCursor: paged.nextCursor,
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

        case 'academic.published': {
          if (!audience) return;

          const delivered = await fanOut({
            recipients: await audience.listClassMemberAccountIds(event.classId),
            // The author does not need telling about their own homework.
            exclude: event.authorAccountId,
            type: 'academic.published',
            category: 'ACADEMIC',
            payload: {
              itemId: event.itemId,
              classId: event.classId,
              itemType: event.itemType,
              title: event.title,
            },
            eventId: event.eventId,
          });

          logger.info(
            { itemId: event.itemId, classId: event.classId, recipients: delivered },
            'Academic notification fanned out',
          );
          return;
        }

        case 'notice.published': {
          if (!audience) return;

          await fanOut({
            recipients: await audience.listSchoolMemberAccountIds(event.schoolId),
            exclude: event.authorAccountId,
            type: 'notice.published',
            category: 'NOTICE',
            payload: { noticeId: event.noticeId, schoolId: event.schoolId, title: event.title },
            eventId: event.eventId,
          });

          return;
        }

        case 'event.published': {
          if (!audience) return;

          // No author to exclude: an event belongs to the school account, and the school is not
          // in its own membership table.
          await fanOut({
            recipients: await audience.listSchoolMemberAccountIds(event.schoolId),
            type: 'event.published',
            category: 'EVENT',
            payload: {
              eventId: event.eventEntityId,
              schoolId: event.schoolId,
              title: event.title,
              eventAt: event.eventAt,
            },
            eventId: event.eventId,
          });

          return;
        }

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
