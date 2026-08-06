/**
 * Timetable persistence. **The only file in this pair that touches Prisma.**
 */
import type { Db } from '../../shared/db/index.js';
import type { Weekday } from '@connected/types';

export interface TimetablePeriodRow {
  id: string;
  day: Weekday;
  startsAt: string;
  endsAt: string;
  subjectId: string | null;
  subject: { name: string } | null;
  label: string | null;
}

export interface TimetableRow {
  id: string;
  classId: string;
  imageKey: string | null;
  version: number;
  createdAt: Date;
  periods: TimetablePeriodRow[];
}

/** What one version is made of. Exactly one of these is present; the service enforces that. */
export interface TimetableContent {
  imageKey?: string | undefined;
  periods?:
    | {
        day: Weekday;
        startsAt: string;
        endsAt: string;
        subjectId?: string | undefined;
        label?: string | undefined;
      }[]
    | undefined;
}

export interface TimetableRepository {
  /** Stores a new version. Returns the row, whose `version` is one past the previous latest. */
  add: (input: { classId: string } & TimetableContent) => Promise<TimetableRow>;
  /** The subject ids of a class, for checking that a period names one of them. */
  subjectIdsOf: (classId: string) => Promise<string[]>;
  findLatest: (classId: string) => Promise<TimetableRow | null>;
  /** Every version, newest first. Bounded by the `@@unique([classId, version])` history. */
  listVersions: (classId: string, limit: number) => Promise<TimetableRow[]>;
}

const SELECT = {
  id: true,
  classId: true,
  imageKey: true,
  version: true,
  createdAt: true,
  periods: {
    select: {
      id: true,
      day: true,
      startsAt: true,
      endsAt: true,
      subjectId: true,
      label: true,
      subject: { select: { name: true } },
    },
    // Ordered here rather than in the service: a grid is read far more often than it is written,
    // and Postgres sorts `HH:MM` strings correctly because they are zero-padded.
    orderBy: [{ day: 'asc' as const }, { startsAt: 'asc' as const }],
  },
};

export function createTimetableRepository(db: Db): TimetableRepository {
  return {
    subjectIdsOf: async (classId) =>
      (await db.subject.findMany({ where: { classId }, select: { id: true } })).map(
        (row) => row.id,
      ),

    /**
     * The version is `max + 1`, read and written in one transaction.
     *
     * Two uploads for the same class at the same moment can still collide on
     * `@@unique([class_id, version])` — the read is not a lock. That is the constraint doing its
     * job rather than a bug: the loser retries and lands on the next number, instead of two rows
     * quietly claiming to be version 3.
     */
    add: async ({ classId, imageKey, periods }) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await db.$transaction(async (tx) => {
            const latest = await tx.timetable.findFirst({
              where: { classId },
              orderBy: { version: 'desc' },
              select: { version: true },
            });

            return tx.timetable.create({
              data: {
                classId,
                imageKey: imageKey ?? null,
                version: (latest?.version ?? 0) + 1,
                // Written with the version, in the same transaction: a timetable that exists for
                // even a moment without its periods is one a parent can read as empty.
                ...(periods
                  ? {
                      periods: {
                        create: periods.map((period) => ({
                          day: period.day,
                          startsAt: period.startsAt,
                          endsAt: period.endsAt,
                          subjectId: period.subjectId ?? null,
                          label: period.label ?? null,
                        })),
                      },
                    }
                  : {}),
              },
              select: SELECT,
            });
          });
        } catch (error) {
          const isVersionCollision =
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string }).code === 'P2002';

          if (!isVersionCollision || attempt === 2) throw error;
        }
      }

      // Unreachable: the loop either returns or rethrows.
      throw new Error('Could not allocate a timetable version.');
    },

    findLatest: async (classId) =>
      db.timetable.findFirst({
        where: { classId },
        orderBy: { version: 'desc' },
        select: SELECT,
      }),

    listVersions: async (classId, limit) =>
      db.timetable.findMany({
        where: { classId },
        orderBy: { version: 'desc' },
        take: limit,
        select: SELECT,
      }),
  };
}
