/**
 * Gradebook persistence. **The only file in this module that touches Prisma.**
 *
 * Scores cross this boundary as strings, not numbers. The column is `decimal(6,2)` and Prisma hands
 * back a `Decimal`; converting to a JS number would quietly lose 17.5's exactness at the one place
 * in the product where a wrong digit is a wrong result for a child.
 */
import { recordEvent } from '../../shared/outbox/index.js';

import type { Db } from '../../shared/db/index.js';
import type { PublishableEvent } from '../../shared/events/index.js';
import type { AssessmentKind } from '../../generated/prisma/client.js';

export interface AssessmentRow {
  id: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  kind: AssessmentKind;
  title: string;
  maxScore: string;
  occurredOn: Date;
  authorAccountId: string;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface MarkRow {
  studentAccountId: string;
  studentName: string;
  score: string | null;
  remark: string | null;
}

export interface GradebookRepository {
  createAssessment: (input: {
    subjectId: string;
    classId: string;
    kind: AssessmentKind;
    title: string;
    maxScore: string;
    occurredOn: Date;
    authorAccountId: string;
  }) => Promise<AssessmentRow>;
  findAssessment: (id: string) => Promise<AssessmentRow | null>;
  listForClass: (classId: string, options: { publishedOnly: boolean }) => Promise<AssessmentRow[]>;
  listForSubject: (subjectId: string) => Promise<AssessmentRow[]>;
  /** Upserts the whole class's marks in one transaction — a half-entered assessment helps nobody. */
  enterMarks: (
    assessmentId: string,
    marks: { studentAccountId: string; score: string | null; remark?: string | undefined }[],
  ) => Promise<void>;
  listMarks: (assessmentId: string) => Promise<MarkRow[]>;
  findMark: (assessmentId: string, studentAccountId: string) => Promise<MarkRow | null>;
  /** Publishing stamps the assessment and records the event in the same transaction (ADR-0019). */
  publish: (
    assessmentId: string,
    toEvent: (row: AssessmentRow) => PublishableEvent,
  ) => Promise<AssessmentRow>;
  /** A correction to a published mark, audited with what it replaced. */
  correctMark: (input: {
    assessmentId: string;
    studentAccountId: string;
    score: string | null;
    remark?: string | undefined;
    previous: { score: string | null; remark: string | null };
    actorAccountId: string;
  }) => Promise<MarkRow>;
  softDeleteAssessment: (id: string) => Promise<void>;
  /** Verified student accounts of a class — who an assessment applies to (FR-GRADE-003). */
  listClassStudentAccountIds: (classId: string) => Promise<string[]>;
  /** The pupil account a parent's child record points at, once the school has linked it. */
  pupilAccountForChild: (childId: string) => Promise<string | null>;
}

const ASSESSMENT_SELECT = {
  id: true,
  subjectId: true,
  classId: true,
  kind: true,
  title: true,
  maxScore: true,
  occurredOn: true,
  authorAccountId: true,
  publishedAt: true,
  createdAt: true,
  subject: { select: { name: true } },
} as const;

interface RawAssessment {
  id: string;
  subjectId: string;
  classId: string;
  kind: AssessmentKind;
  title: string;
  maxScore: { toString: () => string };
  occurredOn: Date;
  authorAccountId: string;
  publishedAt: Date | null;
  createdAt: Date;
  subject: { name: string } | null;
}

function toAssessment(raw: RawAssessment): AssessmentRow {
  return {
    id: raw.id,
    subjectId: raw.subjectId,
    subjectName: raw.subject?.name ?? '',
    classId: raw.classId,
    kind: raw.kind,
    title: raw.title,
    maxScore: raw.maxScore.toString(),
    occurredOn: raw.occurredOn,
    authorAccountId: raw.authorAccountId,
    publishedAt: raw.publishedAt,
    createdAt: raw.createdAt,
  };
}

export function createGradebookRepository(db: Db): GradebookRepository {
  return {
    createAssessment: async (input) => {
      const row = await db.assessment.create({
        data: { ...input, maxScore: input.maxScore },
        select: ASSESSMENT_SELECT,
      });
      return toAssessment(row);
    },

    findAssessment: async (id) => {
      const row = await db.assessment.findFirst({
        where: { id, deletedAt: null },
        select: ASSESSMENT_SELECT,
      });
      return row ? toAssessment(row) : null;
    },

    listForClass: async (classId, { publishedOnly }) => {
      const rows = await db.assessment.findMany({
        where: {
          classId,
          deletedAt: null,
          ...(publishedOnly ? { publishedAt: { not: null } } : {}),
        },
        select: ASSESSMENT_SELECT,
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
      });
      return rows.map(toAssessment);
    },

    listForSubject: async (subjectId) => {
      const rows = await db.assessment.findMany({
        where: { subjectId, deletedAt: null },
        select: ASSESSMENT_SELECT,
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
      });
      return rows.map(toAssessment);
    },

    enterMarks: async (assessmentId, marks) => {
      await db.$transaction(
        marks.map((mark) =>
          db.mark.upsert({
            where: {
              assessmentId_studentAccountId: {
                assessmentId,
                studentAccountId: mark.studentAccountId,
              },
            },
            update: { score: mark.score, remark: mark.remark ?? null },
            create: {
              assessmentId,
              studentAccountId: mark.studentAccountId,
              score: mark.score,
              remark: mark.remark ?? null,
            },
          }),
        ),
      );
    },

    listMarks: async (assessmentId) => {
      const rows = await db.mark.findMany({
        where: { assessmentId },
        select: {
          studentAccountId: true,
          score: true,
          remark: true,
          student: { select: { userProfile: { select: { fullName: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      });

      return rows.map((row) => ({
        studentAccountId: row.studentAccountId,
        studentName: row.student?.userProfile?.fullName ?? '',
        score: row.score?.toString() ?? null,
        remark: row.remark,
      }));
    },

    findMark: async (assessmentId, studentAccountId) => {
      const row = await db.mark.findUnique({
        where: { assessmentId_studentAccountId: { assessmentId, studentAccountId } },
        select: {
          studentAccountId: true,
          score: true,
          remark: true,
          student: { select: { userProfile: { select: { fullName: true } } } },
        },
      });

      if (!row) return null;

      return {
        studentAccountId: row.studentAccountId,
        studentName: row.student?.userProfile?.fullName ?? '',
        score: row.score?.toString() ?? null,
        remark: row.remark,
      };
    },

    publish: async (assessmentId, toEvent) => {
      return db.$transaction(async (tx) => {
        const row = await tx.assessment.update({
          where: { id: assessmentId },
          data: { publishedAt: new Date() },
          select: ASSESSMENT_SELECT,
        });

        const assessment = toAssessment(row);
        await recordEvent(tx, toEvent(assessment));

        return assessment;
      });
    },

    correctMark: async ({
      assessmentId,
      studentAccountId,
      score,
      remark,
      previous,
      actorAccountId,
    }) => {
      return db.$transaction(async (tx) => {
        const row = await tx.mark.update({
          where: { assessmentId_studentAccountId: { assessmentId, studentAccountId } },
          data: { score, remark: remark ?? null },
          select: {
            studentAccountId: true,
            score: true,
            remark: true,
            student: { select: { userProfile: { select: { fullName: true } } } },
          },
        });

        // The trail carries what it replaced. A corrected mark is exactly the thing somebody has
        // to explain later, and "it says 62 now" is not an explanation.
        await tx.auditLog.create({
          data: {
            actorAccountId,
            action: 'mark.corrected',
            entity: 'assessment',
            entityId: assessmentId,
            metadata: {
              studentAccountId,
              previousScore: previous.score,
              newScore: score,
              ...(previous.remark ? { previousRemark: previous.remark } : {}),
            },
          },
        });

        return {
          studentAccountId: row.studentAccountId,
          studentName: row.student?.userProfile?.fullName ?? '',
          score: row.score?.toString() ?? null,
          remark: row.remark,
        };
      });
    },

    softDeleteAssessment: async (id) => {
      await db.assessment.update({ where: { id }, data: { deletedAt: new Date() } });
    },

    listClassStudentAccountIds: async (classId) => {
      const rows = await db.membership.findMany({
        where: { classId, role: 'STUDENT', status: 'VERIFIED' },
        select: { accountId: true },
      });
      return rows.map((row) => row.accountId);
    },

    pupilAccountForChild: async (childId) => {
      const child = await db.child.findFirst({
        where: { id: childId, deletedAt: null },
        select: { studentAccountId: true },
      });
      return child?.studentAccountId ?? null;
    },
  };
}
