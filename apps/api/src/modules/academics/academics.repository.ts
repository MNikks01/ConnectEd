/**
 * Academic content persistence. **The only file in this module that touches Prisma.**
 */
import { CURSOR_ORDER, cursorFilter, takeFor } from '../../shared/http/pagination.js';
import { recordProductEvent } from '../../shared/analytics/product-events.js';
import { recordEvent } from '../../shared/outbox/index.js';

import type { PageRequest } from '../../shared/http/pagination.js';
import type { Db } from '../../shared/db/index.js';
import type { PublishableEvent } from '../../shared/events/index.js';
import type { AcademicItemType, ReadReceiptSubject } from '../../generated/prisma/client.js';

export interface AcademicItemRow {
  id: string;
  type: AcademicItemType;
  classId: string;
  subjectId: string;
  subjectName: string | null;
  title: string;
  body: string;
  imageKey: string | null;
  dueAt: Date | null;
  authorAccountId: string;
  authorName: string | null;
  createdAt: Date;
}

export interface AcademicsRepository {
  /**
   * Creates the item and records its event in **one transaction** (ADR-0019).
   *
   * `toEvent` is a callback rather than an argument because the event carries the new row's id,
   * which does not exist until the insert has run — and the whole point is that both land inside
   * the same transaction or neither does. A service that built the event afterwards would be back
   * to a write that has committed and an event that may never exist.
   */
  create: (
    input: {
      type: AcademicItemType;
      classId: string;
      subjectId: string;
      authorAccountId: string;
      title: string;
      body: string;
      imageKey?: string | undefined;
      dueAt?: Date | undefined;
    },
    toEvent: (row: AcademicItemRow) => PublishableEvent,
  ) => Promise<AcademicItemRow>;
  findById: (id: string) => Promise<AcademicItemRow | null>;
  listForClass: (classId: string, page: PageRequest) => Promise<AcademicItemRow[]>;
  update: (
    id: string,
    data: { title?: string; body?: string; imageKey?: string | null; dueAt?: Date | null },
  ) => Promise<AcademicItemRow>;
  softDelete: (id: string) => Promise<void>;
  markRead: (itemId: string, accountId: string) => Promise<void>;
  readItemIds: (itemIds: string[], accountId: string) => Promise<Set<string>>;
  readCounts: (itemIds: string[]) => Promise<Map<string, number>>;
  subjectClassId: (subjectId: string) => Promise<string | null>;
}

const ITEM_SELECT = {
  id: true,
  type: true,
  classId: true,
  subjectId: true,
  title: true,
  body: true,
  imageKey: true,
  dueAt: true,
  authorAccountId: true,
  createdAt: true,
  subject: { select: { name: true } },
  author: { select: { userProfile: { select: { fullName: true } } } },
} as const;

interface RawItem {
  id: string;
  type: AcademicItemType;
  classId: string;
  subjectId: string;
  title: string;
  body: string;
  imageKey: string | null;
  dueAt: Date | null;
  authorAccountId: string;
  createdAt: Date;
  subject: { name: string } | null;
  author: { userProfile: { fullName: string } | null } | null;
}

function toRow(raw: RawItem): AcademicItemRow {
  return {
    id: raw.id,
    type: raw.type,
    classId: raw.classId,
    subjectId: raw.subjectId,
    subjectName: raw.subject?.name ?? null,
    title: raw.title,
    body: raw.body,
    imageKey: raw.imageKey,
    dueAt: raw.dueAt,
    authorAccountId: raw.authorAccountId,
    authorName: raw.author?.userProfile?.fullName ?? null,
    createdAt: raw.createdAt,
  };
}

const SUBJECT_TYPE: ReadReceiptSubject = 'ACADEMIC_ITEM';

export function createAcademicsRepository(db: Db): AcademicsRepository {
  return {
    create: async (input, toEvent) => {
      return db.$transaction(async (tx) => {
        const row = await tx.academicItem.create({
          data: {
            type: input.type,
            classId: input.classId,
            subjectId: input.subjectId,
            authorAccountId: input.authorAccountId,
            title: input.title,
            body: input.body,
            ...(input.imageKey ? { imageKey: input.imageKey } : {}),
            ...(input.dueAt ? { dueAt: input.dueAt } : {}),
          },
          select: ITEM_SELECT,
        });

        const item = toRow(row);
        await recordEvent(tx, toEvent(item));

        // The homework loop's first step (S9-15). The type and the class, and deliberately not the
        // title: this row outlives the item, and a withdrawn piece of homework should not leave its
        // name behind in an analytics table.
        await recordProductEvent(tx, {
          type: 'academic.published',
          accountId: input.authorAccountId,
          payload: { itemType: input.type, classId: input.classId },
        });

        return item;
      });
    },

    findById: async (id) => {
      const row = await db.academicItem.findFirst({
        // Soft-deleted items are gone as far as every reader is concerned.
        where: { id, deletedAt: null },
        select: ITEM_SELECT,
      });
      return row ? toRow(row) : null;
    },

    listForClass: async (classId, page) => {
      const rows = await db.academicItem.findMany({
        where: { classId, deletedAt: null, ...cursorFilter(page.after) },
        select: ITEM_SELECT,
        orderBy: [...CURSOR_ORDER],
        take: takeFor(page.limit),
      });
      return rows.map(toRow);
    },

    update: async (id, data) => {
      const row = await db.academicItem.update({
        where: { id },
        data: {
          ...(data.title === undefined ? {} : { title: data.title }),
          ...(data.body === undefined ? {} : { body: data.body }),
          ...(data.imageKey === undefined ? {} : { imageKey: data.imageKey }),
          ...(data.dueAt === undefined ? {} : { dueAt: data.dueAt }),
        },
        select: ITEM_SELECT,
      });
      return toRow(row);
    },

    /** Soft delete: the row stays for audit and read history, but leaves every feed. */
    softDelete: async (id) => {
      await db.academicItem.update({ where: { id }, data: { deletedAt: new Date() } });
    },

    /**
     * Idempotent by the `(subject_type, subject_id, account_id)` constraint, so opening an item
     * twice does not move the timestamp or fail. Read tracking is a side effect of viewing, and a
     * side effect that can error would take the whole read request down with it.
     */
    markRead: async (itemId, accountId) => {
      await db.readReceipt.createMany({
        data: [{ subjectType: SUBJECT_TYPE, subjectId: itemId, accountId }],
        skipDuplicates: true,
      });
    },

    /** One query for a whole page, rather than one per item — the N+1 the feed would otherwise do. */
    readItemIds: async (itemIds, accountId) => {
      if (itemIds.length === 0) return new Set();

      const rows = await db.readReceipt.findMany({
        where: { subjectType: SUBJECT_TYPE, subjectId: { in: itemIds }, accountId },
        select: { subjectId: true },
      });

      return new Set(rows.map((row) => row.subjectId));
    },

    readCounts: async (itemIds) => {
      if (itemIds.length === 0) return new Map();

      const rows = await db.readReceipt.groupBy({
        by: ['subjectId'],
        where: { subjectType: SUBJECT_TYPE, subjectId: { in: itemIds } },
        _count: { subjectId: true },
      });

      return new Map(rows.map((row) => [row.subjectId, row._count.subjectId]));
    },

    subjectClassId: async (subjectId) =>
      (await db.subject.findUnique({ where: { id: subjectId }, select: { classId: true } }))
        ?.classId ?? null,
  };
}
