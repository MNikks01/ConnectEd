/**
 * Class timetables — an image or a structured week (FR-ACAD-020, FR-ACAD-021).
 *
 * Uploading is the school's alone (permission matrix, *Upload timetable*); viewing is every
 * verified member of the class, which is the same audience as the class feed.
 *
 * A new upload does not replace the old one — it becomes version *n+1*, and the previous versions
 * stay. A timetable changes mid-term and someone always needs to know what it said last week.
 *
 * **The structured form is a second representation, not a replacement.** A school that photographs
 * the sheet on the wall is not doing it wrong; the PRD asks for both (FR-ACAD-020 says
 * "image/structured"). One version is one or the other, and a school can switch between them
 * whenever it likes — version 4 being a grid after three photographs is an ordinary history.
 *
 * What the structured form buys is what a photograph cannot give: the server can *check* it. A
 * period naming a subject of a different class, or two lessons at the same time on a Tuesday, are
 * both refused here. On an image nobody finds out until a class turns up in the wrong room.
 */
import { assertIsSchool, assertVerifiedMemberOfClass } from '../../shared/authz/index.js';
import { NotFoundError, ValidationFailedError } from '../../shared/errors/index.js';

import type { MediaClaims } from './academics.service.js';
import type { TimetableRepository, TimetableRow } from './timetable.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type {
  TimetablePeriodInput,
  TimetableResponse,
  UploadTimetableInput,
} from '@connected/types';

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
  media?: MediaClaims | undefined;
}

export function createTimetableService({
  repository,
  db,
  storage,
  logger,
  media,
}: TimetableServiceDeps): TimetableService {
  async function toResponse(row: TimetableRow): Promise<TimetableResponse> {
    return {
      id: row.id,
      classId: row.classId,
      kind: row.imageKey ? 'IMAGE' : 'STRUCTURED',
      // Signed only now, after the caller has been authorized for the class.
      imageUrl: storage && row.imageKey ? await storage.signedUrl(row.imageKey) : null,
      version: row.version,
      periods: row.periods.map((period) => ({
        id: period.id,
        day: period.day,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
        subjectId: period.subjectId,
        subjectName: period.subject?.name ?? null,
        label: period.label,
      })),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Everything about a week that zod cannot see.
   *
   * The schema already knows a period ends after it starts and names either a subject or a label.
   * These two need the database and the rest of the week:
   *
   * - **Every subject belongs to this class.** Otherwise a school could point a period at another
   *   school's subject, and the grid would render a name from a class nobody in this one can read.
   * - **No two periods overlap on a day.** This is the whole reason for storing a timetable as
   *   data rather than a picture, and it is checked here rather than by a constraint because
   *   "these two rows must not overlap" is not something Postgres will enforce without an
   *   exclusion constraint that Prisma cannot emit.
   */
  async function assertCoherent(classId: string, periods: TimetablePeriodInput[]): Promise<void> {
    const named = periods.flatMap((period) => (period.subjectId ? [period.subjectId] : []));

    if (named.length > 0) {
      const known = new Set(await repository.subjectIdsOf(classId));
      const stranger = named.find((subjectId) => !known.has(subjectId));

      if (stranger) {
        throw new ValidationFailedError(
          [{ field: 'periods', issue: `Unknown subject ${stranger}.` }],
          'A period names a subject that is not taught in this class.',
        );
      }
    }

    const byDay = new Map<string, TimetablePeriodInput[]>();
    for (const period of periods) {
      byDay.set(period.day, [...(byDay.get(period.day) ?? []), period]);
    }

    for (const [day, ofThatDay] of byDay) {
      const inOrder = [...ofThatDay].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

      for (let i = 1; i < inOrder.length; i += 1) {
        const previous = inOrder[i - 1];
        const current = inOrder[i];
        // Touching is fine — one period ending at 10:00 and the next starting at 10:00 is a
        // normal timetable. Only a genuine overlap is refused.
        if (previous && current && current.startsAt < previous.endsAt) {
          throw new ValidationFailedError(
            [
              {
                field: 'periods',
                issue: `${day}: ${previous.startsAt}–${previous.endsAt} overlaps ${current.startsAt}–${current.endsAt}.`,
              },
            ],
            'Two periods overlap.',
          );
        }
      }
    }
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

      if (input.periods) await assertCoherent(classId, input.periods);

      const row = await repository.add({ classId, ...input });

      // Referenced now, so it is no longer an orphan. Nothing to claim for a structured week.
      if (input.imageKey) await media?.claim(input.imageKey);

      logger.info(
        { classId, version: row.version, kind: input.periods ? 'structured' : 'image' },
        'Timetable published',
      );

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
