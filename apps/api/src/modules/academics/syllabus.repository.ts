/**
 * Syllabus coverage persistence. **The only file in this pair that touches Prisma.**
 */
import type { Db } from '../../shared/db/index.js';

export interface SyllabusTopicRow {
  id: string;
  subjectId: string;
  topic: string;
  percent: number;
  updatedByAccountId: string | null;
  updatedByName: string | null;
  updatedAt: Date;
}

export interface SubjectRef {
  id: string;
  name: string;
  classId: string;
}

export interface SyllabusRepository {
  findSubject: (subjectId: string) => Promise<SubjectRef | null>;
  /** Every subject of a class, so coverage can be answered for the whole class in one request. */
  listSubjectsOfClass: (classId: string) => Promise<SubjectRef[]>;
  /** Records a topic's progress, replacing any earlier figure for the same topic. */
  upsertTopic: (input: {
    subjectId: string;
    topic: string;
    percent: number;
    updatedBy: string;
  }) => Promise<SyllabusTopicRow>;
  listForSubject: (subjectId: string) => Promise<SyllabusTopicRow[]>;
  /** One query for a whole class's topics, rather than one per subject. */
  listForSubjects: (subjectIds: string[]) => Promise<SyllabusTopicRow[]>;
  findTopic: (id: string) => Promise<SyllabusTopicRow | null>;
  remove: (id: string) => Promise<void>;
}

const SELECT = {
  id: true,
  subjectId: true,
  topic: true,
  percent: true,
  updatedBy: true,
  updatedAt: true,
} as const;

interface RawTopic {
  id: string;
  subjectId: string;
  topic: string;
  percent: number;
  updatedBy: string | null;
  updatedAt: Date;
}

function toRow(raw: RawTopic, updatedByName: string | null): SyllabusTopicRow {
  return {
    id: raw.id,
    subjectId: raw.subjectId,
    topic: raw.topic,
    percent: raw.percent,
    updatedByAccountId: raw.updatedBy,
    updatedByName,
    updatedAt: raw.updatedAt,
  };
}

export function createSyllabusRepository(db: Db): SyllabusRepository {
  /**
   * `updated_by` is a plain column rather than a relation in the schema, so the name is looked up
   * separately. One query for the whole list, not one per row.
   */
  async function namesFor(accountIds: (string | null)[]): Promise<Map<string, string>> {
    const ids = [...new Set(accountIds.filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Map();

    const profiles = await db.userProfile.findMany({
      where: { accountId: { in: ids } },
      select: { accountId: true, fullName: true },
    });

    return new Map(profiles.map((profile) => [profile.accountId, profile.fullName]));
  }

  return {
    findSubject: async (subjectId) =>
      db.subject.findUnique({
        where: { id: subjectId },
        select: { id: true, name: true, classId: true },
      }),

    listSubjectsOfClass: async (classId) =>
      db.subject.findMany({
        where: { classId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, classId: true },
      }),

    upsertTopic: async ({ subjectId, topic, percent, updatedBy }) => {
      const raw = await db.syllabusProgress.upsert({
        // The `@@unique([subject_id, topic])` constraint is what makes re-recording the same topic
        // an update rather than a second row claiming a different figure for the same thing.
        where: { subjectId_topic: { subjectId, topic } },
        update: { percent, updatedBy },
        create: { subjectId, topic, percent, updatedBy },
        select: SELECT,
      });

      const names = await namesFor([raw.updatedBy]);
      return toRow(raw, raw.updatedBy ? (names.get(raw.updatedBy) ?? null) : null);
    },

    listForSubject: async (subjectId) => {
      const rows = await db.syllabusProgress.findMany({
        where: { subjectId },
        // By topic name: a syllabus is read as a list of chapters, not by when each was last touched.
        orderBy: { topic: 'asc' },
        select: SELECT,
      });

      const names = await namesFor(rows.map((row) => row.updatedBy));

      return rows.map((row) =>
        toRow(row, row.updatedBy ? (names.get(row.updatedBy) ?? null) : null),
      );
    },

    listForSubjects: async (subjectIds) => {
      if (subjectIds.length === 0) return [];

      const rows = await db.syllabusProgress.findMany({
        where: { subjectId: { in: subjectIds } },
        orderBy: { topic: 'asc' },
        select: SELECT,
      });

      const names = await namesFor(rows.map((row) => row.updatedBy));

      return rows.map((row) =>
        toRow(row, row.updatedBy ? (names.get(row.updatedBy) ?? null) : null),
      );
    },

    findTopic: async (id) => {
      const raw = await db.syllabusProgress.findUnique({ where: { id }, select: SELECT });
      if (!raw) return null;

      const names = await namesFor([raw.updatedBy]);
      return toRow(raw, raw.updatedBy ? (names.get(raw.updatedBy) ?? null) : null);
    },

    remove: async (id) => {
      await db.syllabusProgress.delete({ where: { id } });
    },
  };
}
