/**
 * Academic content: publishing, reading, and read tracking (FR-ACAD-001..006).
 *
 * This is the first module whose whole purpose sits behind verification, and it is where the
 * policies written in S0-7 finally do real work:
 *
 * - publishing calls `assertTeacherAllocatedToSubject` — a verified teacher of the school is not
 *   enough, it must be *this* subject in *this* class
 * - reading calls `assertVerifiedMemberOfClass` — the same check a student, a parent of a child in
 *   the class, a school-wide teacher, and the school itself all pass, and nobody else does
 *
 * Signed image URLs are issued **after** those checks, never before. Handing out a URL and relying
 * on the key being unguessable would make the bucket the authorization boundary.
 */
import {
  assertOwnsResource,
  assertTeacherAllocatedToSubject,
  assertVerifiedMemberOfClass,
} from '../../shared/authz/index.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { toPage } from '../../shared/http/pagination.js';

import type { AcademicItemRow, AcademicsRepository } from './academics.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Db } from '../../shared/db/index.js';
import type { Page, PageRequest } from '../../shared/http/pagination.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type {
  AcademicItemResponse,
  PublishAcademicItemInput,
  UpdateAcademicItemInput,
} from '@connected/types';

export interface AcademicsService {
  publish: (
    actor: Actor,
    classId: string,
    input: PublishAcademicItemInput,
  ) => Promise<AcademicItemResponse>;
  listForClass: (
    actor: Actor,
    classId: string,
    page: PageRequest,
  ) => Promise<Page<AcademicItemResponse>>;
  /** Reading an item marks it read for the caller (FR-ACAD-003). */
  read: (actor: Actor, itemId: string) => Promise<AcademicItemResponse>;
  update: (
    actor: Actor,
    itemId: string,
    input: UpdateAcademicItemInput,
  ) => Promise<AcademicItemResponse>;
  remove: (actor: Actor, itemId: string) => Promise<void>;
}

/**
 * The slice of media this module needs.
 *
 * A narrow port rather than the whole `MediaService`: academics only ever tells media "this key is
 * now referenced", and depending on the full interface would let that quietly grow.
 */
export interface MediaClaims {
  claim: (key: string) => Promise<void>;
}

export interface AcademicsServiceDeps {
  repository: AcademicsRepository;
  db: Db;
  storage?: Storage | undefined;
  logger: Logger;
  media?: MediaClaims | undefined;
}

export function createAcademicsService({
  repository,
  db,
  storage,
  logger,
  media,
}: AcademicsServiceDeps): AcademicsService {
  /** Only the author and the school see who has read an item. */
  function maySeeReadCounts(actor: Actor, item: AcademicItemRow, schoolOwned: boolean): boolean {
    return actor.accountId === item.authorAccountId || schoolOwned;
  }

  async function isOwningSchool(actor: Actor, classId: string): Promise<boolean> {
    if (actor.accountType !== 'SCHOOL') return false;

    const klass = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    return klass?.schoolId === actor.accountId;
  }

  async function toResponse(
    row: AcademicItemRow,
    options: { read: boolean; readCount?: number | undefined },
  ): Promise<AcademicItemResponse> {
    return {
      id: row.id,
      type: row.type,
      classId: row.classId,
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      title: row.title,
      body: row.body,
      // Signed only now, after the caller has been authorized for the class.
      imageUrl: row.imageKey && storage ? await storage.signedUrl(row.imageKey) : null,
      dueAt: row.dueAt?.toISOString() ?? null,
      authorAccountId: row.authorAccountId,
      authorName: row.authorName,
      createdAt: row.createdAt.toISOString(),
      read: options.read,
      ...(options.readCount === undefined ? {} : { readCount: options.readCount }),
    };
  }

  /** Loads an item and proves the caller may see the class it belongs to. */
  async function loadReadable(actor: Actor, itemId: string): Promise<AcademicItemRow> {
    const item = await repository.findById(itemId);
    if (!item) throw new NotFoundError();

    await assertVerifiedMemberOfClass(db, actor, item.classId);

    return item;
  }

  return {
    publish: async (actor, classId, input) => {
      // The subject must belong to the class being published to, or a teacher allocated to a
      // subject in class A could publish into class B by naming A's subject.
      const subjectClassId = await repository.subjectClassId(input.subjectId);
      if (subjectClassId !== classId) {
        throw new NotFoundError('That subject is not part of this class.');
      }

      await assertTeacherAllocatedToSubject(db, actor, input.subjectId);

      // The item and its event commit together (ADR-0019). The relay hands the event to the queue
      // afterwards; recipients are resolved by the consumer, not here.
      const item = await repository.create(
        {
          type: input.type,
          classId,
          subjectId: input.subjectId,
          authorAccountId: actor.accountId,
          title: input.title,
          body: input.body,
          ...(input.imageKey ? { imageKey: input.imageKey } : {}),
          ...(input.dueAt ? { dueAt: new Date(input.dueAt) } : {}),
        },
        (created) => ({
          type: 'academic.published',
          itemId: created.id,
          classId,
          itemType: created.type,
          title: created.title,
          authorAccountId: actor.accountId,
        }),
      );

      // The key now has a row pointing at it, so the orphan sweep must leave it alone.
      // The key now has a row pointing at it, so the orphan sweep must leave it alone.
      if (input.imageKey) await media?.claim(input.imageKey);

      logger.info(
        { itemId: item.id, classId, subjectId: input.subjectId, type: input.type },
        'Academic item published',
      );

      return toResponse(item, { read: true, readCount: 0 });
    },

    listForClass: async (actor, classId, page) => {
      await assertVerifiedMemberOfClass(db, actor, classId);

      const rows = await repository.listForClass(classId, page);
      const paged = toPage(rows, page.limit);
      const ids = paged.data.map((row) => row.id);

      // Two batched queries for the whole page rather than two per item.
      const readIds = await repository.readItemIds(ids, actor.accountId);
      const schoolOwned = await isOwningSchool(actor, classId);
      const counts = paged.data.some((row) => maySeeReadCounts(actor, row, schoolOwned))
        ? await repository.readCounts(ids)
        : new Map<string, number>();

      const data = await Promise.all(
        paged.data.map((row) =>
          toResponse(row, {
            read: readIds.has(row.id),
            readCount: maySeeReadCounts(actor, row, schoolOwned)
              ? (counts.get(row.id) ?? 0)
              : undefined,
          }),
        ),
      );

      return { data, nextCursor: paged.nextCursor };
    },

    read: async (actor, itemId) => {
      const item = await loadReadable(actor, itemId);

      // The author reading their own item should not inflate the count they are about to see.
      if (actor.accountId !== item.authorAccountId && actor.accountType !== 'SCHOOL') {
        await repository.markRead(itemId, actor.accountId);
      }

      const schoolOwned = await isOwningSchool(actor, item.classId);
      const counts = maySeeReadCounts(actor, item, schoolOwned)
        ? await repository.readCounts([itemId])
        : undefined;

      return toResponse(item, {
        read: true,
        readCount: counts ? (counts.get(itemId) ?? 0) : undefined,
      });
    },

    update: async (actor, itemId, input) => {
      const item = await repository.findById(itemId);
      if (!item) throw new NotFoundError();

      // Author or the owning school (FR-ACAD-005). A different teacher of the same class may not
      // edit someone else's homework.
      if (!(await isOwningSchool(actor, item.classId))) {
        assertOwnsResource(actor, item.authorAccountId);
      }

      if (input.imageKey) await media?.claim(input.imageKey);

      const updated = await repository.update(itemId, {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(input.imageKey === undefined ? {} : { imageKey: input.imageKey ?? null }),
        ...(input.dueAt === undefined ? {} : { dueAt: input.dueAt ? new Date(input.dueAt) : null }),
      });

      return toResponse(updated, { read: true, readCount: undefined });
    },

    remove: async (actor, itemId) => {
      const item = await repository.findById(itemId);
      if (!item) throw new NotFoundError();

      if (!(await isOwningSchool(actor, item.classId))) {
        assertOwnsResource(actor, item.authorAccountId);
      }

      await repository.softDelete(itemId);
      logger.info({ itemId, accountId: actor.accountId }, 'Academic item deleted');
    },
  };
}
