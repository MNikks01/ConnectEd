/**
 * Notices and events (FR-ACAD-010, 011, 012).
 *
 * The authorization shape differs from homework in one important way: homework is scoped to a
 * class, notices and events are scoped to the **school**. So the write side asks "are you this
 * school, or its verified principal?" and the read side asks "do you hold any verified membership
 * here?" — a parent of a Class 3 child and a Class 12 teacher are both part of the community a
 * notice addresses.
 *
 * Publishing fans out to every verified member of the school, which is the largest audience in the
 * product so far. The recipients are resolved by the notifications consumer, not here.
 */
import {
  assertIsSchool,
  assertMayPublishNotice,
  assertOwnsResource,
  assertVerifiedMemberOfSchool,
} from '../../shared/authz/index.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { BOUNDED_LIST_CAP, toPage } from '../../shared/http/pagination.js';

import type { EventRow, NoticeRow, NoticesRepository } from './notices.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Db } from '../../shared/db/index.js';
import type { EventPublisher } from '../../shared/events/index.js';
import type { Page, PageRequest } from '../../shared/http/pagination.js';
import type { Logger } from '../../shared/logger/index.js';
import type {
  CreateEventInput,
  CreateNoticeInput,
  EventResponse,
  NoticeResponse,
  UpdateEventInput,
  UpdateNoticeInput,
} from '@connected/types';

export interface NoticesService {
  publishNotice: (
    actor: Actor,
    schoolId: string,
    input: CreateNoticeInput,
  ) => Promise<NoticeResponse>;
  listNotices: (actor: Actor, schoolId: string, page: PageRequest) => Promise<Page<NoticeResponse>>;
  /** Reading a notice marks it read for the caller (FR-ACAD-010). */
  readNotice: (actor: Actor, noticeId: string) => Promise<NoticeResponse>;
  updateNotice: (
    actor: Actor,
    noticeId: string,
    input: UpdateNoticeInput,
  ) => Promise<NoticeResponse>;
  removeNotice: (actor: Actor, noticeId: string) => Promise<void>;

  createEvent: (actor: Actor, schoolId: string, input: CreateEventInput) => Promise<EventResponse>;
  /** Upcoming first, chronologically (FR-ACAD-011). */
  listEvents: (
    actor: Actor,
    schoolId: string,
    options: { includePast: boolean },
  ) => Promise<{ data: EventResponse[] }>;
  updateEvent: (actor: Actor, eventId: string, input: UpdateEventInput) => Promise<EventResponse>;
  removeEvent: (actor: Actor, eventId: string) => Promise<void>;
}

export interface NoticesServiceDeps {
  repository: NoticesRepository;
  db: Db;
  events: EventPublisher;
  logger: Logger;
  /** Injected so the clock can be fixed in tests; `listEvents` splits past from upcoming. */
  now?: (() => Date) | undefined;
}

export function createNoticesService({
  repository,
  db,
  events,
  logger,
  now = () => new Date(),
}: NoticesServiceDeps): NoticesService {
  /** Only the author and the school see who has read a notice. */
  function maySeeReadCounts(actor: Actor, notice: NoticeRow): boolean {
    return actor.accountId === notice.authorAccountId || actor.accountId === notice.schoolId;
  }

  function toNoticeResponse(
    row: NoticeRow,
    options: { read: boolean; readCount?: number | undefined },
  ): NoticeResponse {
    return {
      id: row.id,
      schoolId: row.schoolId,
      title: row.title,
      body: row.body,
      authorAccountId: row.authorAccountId,
      authorName: row.authorName,
      createdAt: row.createdAt.toISOString(),
      read: options.read,
      ...(options.readCount === undefined ? {} : { readCount: options.readCount }),
    };
  }

  function toEventResponse(row: EventRow): EventResponse {
    return {
      id: row.id,
      schoolId: row.schoolId,
      title: row.title,
      body: row.body,
      eventAt: row.eventAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Edit and delete: the author, or the school itself. A principal who wrote a notice may fix it;
   * a *different* principal may not, which is the same rule homework already follows.
   */
  function assertMayModifyNotice(actor: Actor, notice: NoticeRow): void {
    if (actor.accountType === 'SCHOOL' && actor.accountId === notice.schoolId) return;
    assertOwnsResource(actor, notice.authorAccountId);
  }

  return {
    publishNotice: async (actor, schoolId, input) => {
      await assertMayPublishNotice(db, actor, schoolId);

      const notice = await repository.createNotice({
        schoolId,
        authorAccountId: actor.accountId,
        title: input.title,
        body: input.body,
      });

      logger.info({ noticeId: notice.id, schoolId }, 'Notice published');

      await events.publish({
        type: 'notice.published',
        noticeId: notice.id,
        schoolId,
        title: notice.title,
        authorAccountId: actor.accountId,
      });

      return toNoticeResponse(notice, { read: true, readCount: 0 });
    },

    listNotices: async (actor, schoolId, page) => {
      await assertVerifiedMemberOfSchool(db, actor, schoolId);

      const rows = await repository.listNotices(schoolId, page);
      const paged = toPage(rows, page.limit);
      const ids = paged.data.map((row) => row.id);

      // Two batched queries for the whole page rather than two per notice.
      const readIds = await repository.readNoticeIds(ids, actor.accountId);
      const counts = paged.data.some((row) => maySeeReadCounts(actor, row))
        ? await repository.noticeReadCounts(ids)
        : new Map<string, number>();

      return {
        data: paged.data.map((row) =>
          toNoticeResponse(row, {
            read: readIds.has(row.id),
            readCount: maySeeReadCounts(actor, row) ? (counts.get(row.id) ?? 0) : undefined,
          }),
        ),
        nextCursor: paged.nextCursor,
      };
    },

    readNotice: async (actor, noticeId) => {
      const notice = await repository.findNotice(noticeId);
      if (!notice) throw new NotFoundError();

      await assertVerifiedMemberOfSchool(db, actor, notice.schoolId);

      // The author reading their own notice should not inflate the count they are about to see.
      if (actor.accountId !== notice.authorAccountId && actor.accountId !== notice.schoolId) {
        await repository.markNoticeRead(noticeId, actor.accountId);
      }

      const counts = maySeeReadCounts(actor, notice)
        ? await repository.noticeReadCounts([noticeId])
        : undefined;

      return toNoticeResponse(notice, {
        read: true,
        readCount: counts ? (counts.get(noticeId) ?? 0) : undefined,
      });
    },

    updateNotice: async (actor, noticeId, input) => {
      const notice = await repository.findNotice(noticeId);
      if (!notice) throw new NotFoundError();

      assertMayModifyNotice(actor, notice);

      const updated = await repository.updateNotice(noticeId, {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.body === undefined ? {} : { body: input.body }),
      });

      return toNoticeResponse(updated, { read: true, readCount: undefined });
    },

    removeNotice: async (actor, noticeId) => {
      const notice = await repository.findNotice(noticeId);
      if (!notice) throw new NotFoundError();

      assertMayModifyNotice(actor, notice);

      await repository.softDeleteNotice(noticeId);
      logger.info({ noticeId, accountId: actor.accountId }, 'Notice deleted');
    },

    /** Events are the school's alone to create — not the principal's (permission matrix). */
    createEvent: async (actor, schoolId, input) => {
      assertIsSchool(actor, schoolId);

      const created = await repository.createEvent({
        schoolId,
        title: input.title,
        body: input.body,
        eventAt: new Date(input.eventAt),
      });

      logger.info({ eventId: created.id, schoolId }, 'Event created');

      await events.publish({
        type: 'event.published',
        eventEntityId: created.id,
        schoolId,
        title: created.title,
        eventAt: created.eventAt.toISOString(),
      });

      return toEventResponse(created);
    },

    listEvents: async (actor, schoolId, { includePast }) => {
      await assertVerifiedMemberOfSchool(db, actor, schoolId);

      const rows = await repository.listEvents(schoolId, {
        ...(includePast ? {} : { from: now() }),
        limit: BOUNDED_LIST_CAP,
      });

      return { data: rows.map(toEventResponse) };
    },

    updateEvent: async (actor, eventId, input) => {
      const existing = await repository.findEvent(eventId);
      if (!existing) throw new NotFoundError();

      assertIsSchool(actor, existing.schoolId);

      const updated = await repository.updateEvent(eventId, {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(input.eventAt === undefined ? {} : { eventAt: new Date(input.eventAt) }),
      });

      return toEventResponse(updated);
    },

    removeEvent: async (actor, eventId) => {
      const existing = await repository.findEvent(eventId);
      if (!existing) throw new NotFoundError();

      assertIsSchool(actor, existing.schoolId);

      await repository.softDeleteEvent(eventId);
      logger.info({ eventId, accountId: actor.accountId }, 'Event deleted');
    },
  };
}
