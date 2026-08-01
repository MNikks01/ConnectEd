/**
 * Notice and event persistence. **The only file in this pair that touches Prisma.**
 */
import { CURSOR_ORDER, cursorFilter, takeFor } from '../../shared/http/pagination.js';

import type { PageRequest } from '../../shared/http/pagination.js';
import type { Db } from '../../shared/db/index.js';
import type { ReadReceiptSubject } from '../../generated/prisma/client.js';

export interface NoticeRow {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  authorAccountId: string;
  authorName: string | null;
  createdAt: Date;
}

export interface EventRow {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  eventAt: Date;
  createdAt: Date;
}

export interface NoticesRepository {
  createNotice: (input: {
    schoolId: string;
    authorAccountId: string;
    title: string;
    body: string;
  }) => Promise<NoticeRow>;
  findNotice: (id: string) => Promise<NoticeRow | null>;
  listNotices: (schoolId: string, page: PageRequest) => Promise<NoticeRow[]>;
  updateNotice: (id: string, data: { title?: string; body?: string }) => Promise<NoticeRow>;
  softDeleteNotice: (id: string) => Promise<void>;
  markNoticeRead: (noticeId: string, accountId: string) => Promise<void>;
  readNoticeIds: (noticeIds: string[], accountId: string) => Promise<Set<string>>;
  noticeReadCounts: (noticeIds: string[]) => Promise<Map<string, number>>;

  createEvent: (input: {
    schoolId: string;
    title: string;
    body: string;
    eventAt: Date;
  }) => Promise<EventRow>;
  findEvent: (id: string) => Promise<EventRow | null>;
  /**
   * Chronological by `eventAt` (FR-ACAD-011), which is *not* the cursor's sort key. Events are
   * bounded by the school year rather than growing without limit, so this list is capped instead
   * of paged — mixing an `eventAt` order with a `createdAt` cursor would silently skip rows.
   */
  listEvents: (schoolId: string, options: { from?: Date; limit: number }) => Promise<EventRow[]>;
  updateEvent: (
    id: string,
    data: { title?: string; body?: string; eventAt?: Date },
  ) => Promise<EventRow>;
  softDeleteEvent: (id: string) => Promise<void>;
}

const NOTICE_SELECT = {
  id: true,
  schoolId: true,
  title: true,
  body: true,
  authorAccountId: true,
  createdAt: true,
  author: {
    select: {
      userProfile: { select: { fullName: true } },
      schoolProfile: { select: { name: true } },
    },
  },
} as const;

interface RawNotice {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  authorAccountId: string;
  createdAt: Date;
  author: {
    userProfile: { fullName: string } | null;
    schoolProfile: { name: string } | null;
  } | null;
}

function toNotice(raw: RawNotice): NoticeRow {
  return {
    id: raw.id,
    schoolId: raw.schoolId,
    title: raw.title,
    body: raw.body,
    authorAccountId: raw.authorAccountId,
    // A notice is as often written by the school account as by a principal, and a school account
    // has no user profile — falling back to its name keeps "who said this" answerable either way.
    authorName: raw.author?.userProfile?.fullName ?? raw.author?.schoolProfile?.name ?? null,
    createdAt: raw.createdAt,
  };
}

const EVENT_SELECT = {
  id: true,
  schoolId: true,
  title: true,
  body: true,
  eventAt: true,
  createdAt: true,
} as const;

const SUBJECT_TYPE: ReadReceiptSubject = 'NOTICE';

export function createNoticesRepository(db: Db): NoticesRepository {
  return {
    createNotice: async (input) => {
      const row = await db.notice.create({ data: input, select: NOTICE_SELECT });
      return toNotice(row);
    },

    findNotice: async (id) => {
      const row = await db.notice.findFirst({
        where: { id, deletedAt: null },
        select: NOTICE_SELECT,
      });
      return row ? toNotice(row) : null;
    },

    listNotices: async (schoolId, page) => {
      const rows = await db.notice.findMany({
        where: { schoolId, deletedAt: null, ...cursorFilter(page.after) },
        select: NOTICE_SELECT,
        orderBy: [...CURSOR_ORDER],
        take: takeFor(page.limit),
      });
      return rows.map(toNotice);
    },

    updateNotice: async (id, data) => {
      const row = await db.notice.update({
        where: { id },
        data: {
          ...(data.title === undefined ? {} : { title: data.title }),
          ...(data.body === undefined ? {} : { body: data.body }),
        },
        select: NOTICE_SELECT,
      });
      return toNotice(row);
    },

    softDeleteNotice: async (id) => {
      await db.notice.update({ where: { id }, data: { deletedAt: new Date() } });
    },

    /** Idempotent by the `(subject_type, subject_id, account_id)` constraint. */
    markNoticeRead: async (noticeId, accountId) => {
      await db.readReceipt.createMany({
        data: [{ subjectType: SUBJECT_TYPE, subjectId: noticeId, accountId }],
        skipDuplicates: true,
      });
    },

    readNoticeIds: async (noticeIds, accountId) => {
      if (noticeIds.length === 0) return new Set();

      const rows = await db.readReceipt.findMany({
        where: { subjectType: SUBJECT_TYPE, subjectId: { in: noticeIds }, accountId },
        select: { subjectId: true },
      });

      return new Set(rows.map((row) => row.subjectId));
    },

    noticeReadCounts: async (noticeIds) => {
      if (noticeIds.length === 0) return new Map();

      const rows = await db.readReceipt.groupBy({
        by: ['subjectId'],
        where: { subjectType: SUBJECT_TYPE, subjectId: { in: noticeIds } },
        _count: { subjectId: true },
      });

      return new Map(rows.map((row) => [row.subjectId, row._count.subjectId]));
    },

    createEvent: async (input) => db.event.create({ data: input, select: EVENT_SELECT }),

    findEvent: async (id) =>
      db.event.findFirst({ where: { id, deletedAt: null }, select: EVENT_SELECT }),

    listEvents: async (schoolId, { from, limit }) =>
      db.event.findMany({
        where: { schoolId, deletedAt: null, ...(from ? { eventAt: { gte: from } } : {}) },
        select: EVENT_SELECT,
        orderBy: { eventAt: 'asc' },
        take: limit,
      }),

    updateEvent: async (id, data) =>
      db.event.update({
        where: { id },
        data: {
          ...(data.title === undefined ? {} : { title: data.title }),
          ...(data.body === undefined ? {} : { body: data.body }),
          ...(data.eventAt === undefined ? {} : { eventAt: data.eventAt }),
        },
        select: EVENT_SELECT,
      }),

    softDeleteEvent: async (id) => {
      await db.event.update({ where: { id }, data: { deletedAt: new Date() } });
    },
  };
}
