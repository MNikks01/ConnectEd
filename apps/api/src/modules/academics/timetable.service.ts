/**
 * Class timetables (FR-ACAD-020).
 *
 * Uploading is the school's alone (permission matrix, *Upload timetable*); viewing is every
 * verified member of the class, which is the same audience as the class feed.
 *
 * A new upload does not replace the old one — it becomes version *n+1*, and the previous versions
 * stay. A timetable changes mid-term and someone always needs to know what it said last week.
 */
import { assertIsSchool, assertVerifiedMemberOfClass } from '../../shared/authz/index.js';
import { NotFoundError } from '../../shared/errors/index.js';

import type { TimetableRepository, TimetableRow } from './timetable.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type { TimetableResponse, UploadTimetableInput } from '@connected/types';

/** Enough to cover a school year of revisions without becoming an unbounded read. */
const VERSION_HISTORY_LIMIT = 50;

export interface TimetableService {
  upload: (
    actor: Actor,
    classId: string,
    input: UploadTimetableInput,
  ) => Promise<TimetableResponse>;
  /** The current timetable. 404 when the school has not uploaded one yet. */
  current: (actor: Actor, classId: string) => Promise<TimetableResponse>;
  history: (actor: Actor, classId: string) => Promise<{ data: TimetableResponse[] }>;
}

export interface TimetableServiceDeps {
  repository: TimetableRepository;
  db: Db;
  storage?: Storage | undefined;
  logger: Logger;
}

export function createTimetableService({
  repository,
  db,
  storage,
  logger,
}: TimetableServiceDeps): TimetableService {
  async function toResponse(row: TimetableRow): Promise<TimetableResponse> {
    return {
      id: row.id,
      classId: row.classId,
      // Signed only now, after the caller has been authorized for the class.
      imageUrl: storage ? await storage.signedUrl(row.imageKey) : null,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** The class must exist and belong to the school doing the uploading. */
  async function assertOwnsClass(actor: Actor, classId: string): Promise<void> {
    const klass = await db.class.findUnique({
      where: { id: classId },
      select: { schoolId: true },
    });

    // Unknown class and another school's class must be indistinguishable.
    if (!klass) throw new NotFoundError();

    assertIsSchool(actor, klass.schoolId);
  }

  return {
    upload: async (actor, classId, input) => {
      await assertOwnsClass(actor, classId);

      const row = await repository.add({ classId, imageKey: input.imageKey });

      logger.info({ classId, version: row.version }, 'Timetable uploaded');

      return toResponse(row);
    },

    current: async (actor, classId) => {
      await assertVerifiedMemberOfClass(db, actor, classId);

      const row = await repository.findLatest(classId);
      if (!row) throw new NotFoundError('No timetable has been uploaded for this class yet.');

      return toResponse(row);
    },

    history: async (actor, classId) => {
      await assertVerifiedMemberOfClass(db, actor, classId);

      const rows = await repository.listVersions(classId, VERSION_HISTORY_LIMIT);

      return { data: await Promise.all(rows.map((row) => toResponse(row))) };
    },
  };
}
