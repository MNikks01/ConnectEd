/**
 * Timetable persistence. **The only file in this pair that touches Prisma.**
 */
import type { Db } from '../../shared/db/index.js';

export interface TimetableRow {
  id: string;
  classId: string;
  imageKey: string;
  version: number;
  createdAt: Date;
}

export interface TimetableRepository {
  /** Stores a new version. Returns the row, whose `version` is one past the previous latest. */
  add: (input: { classId: string; imageKey: string }) => Promise<TimetableRow>;
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
} as const;

export function createTimetableRepository(db: Db): TimetableRepository {
  return {
    /**
     * The version is `max + 1`, read and written in one transaction.
     *
     * Two uploads for the same class at the same moment can still collide on
     * `@@unique([class_id, version])` — the read is not a lock. That is the constraint doing its
     * job rather than a bug: the loser retries and lands on the next number, instead of two rows
     * quietly claiming to be version 3.
     */
    add: async ({ classId, imageKey }) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await db.$transaction(async (tx) => {
            const latest = await tx.timetable.findFirst({
              where: { classId },
              orderBy: { version: 'desc' },
              select: { version: true },
            });

            return tx.timetable.create({
              data: { classId, imageKey, version: (latest?.version ?? 0) + 1 },
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
