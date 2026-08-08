/**
 * Terms and report cards. **The only file in this module that touches Prisma.**
 */
import type { Db } from '../../shared/db/index.js';
import type { Prisma } from '../../generated/prisma/client.js';

export interface TermRow {
  id: string;
  schoolId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  frozen: boolean;
}

export interface CardRow {
  id: string;
  termId: string;
  termName: string;
  classId: string;
  studentAccountId: string;
  studentName: string;
  issuedAt: Date;
  replacedIssuedAt: Date | null;
  comment: string | null;
  snapshot: unknown;
}

/** One marked assessment, as the arithmetic needs it. */
export interface MarkedAssessment {
  subjectName: string;
  title: string;
  occurredOn: Date;
  maxScore: string;
  /** Null when this pupil was not marked — excluded from the totals rather than counted as zero. */
  score: string | null;
}

export interface ReportCardsRepository {
  createTerm: (input: {
    schoolId: string;
    name: string;
    startDate: Date;
    endDate: Date;
  }) => Promise<TermRow>;
  listTerms: (schoolId: string) => Promise<TermRow[]>;
  findTerm: (termId: string) => Promise<TermRow | null>;
  /** Any term of this school whose range touches the given one — the overlap check (FR-GRADE-030). */
  overlappingTerm: (schoolId: string, startDate: Date, endDate: Date) => Promise<TermRow | null>;
  /**
   * Every **published** assessment in the term for a class, with this pupil's mark where one
   * exists. Unpublished work is not on a card and does not count towards it.
   */
  markedAssessmentsFor: (input: {
    classId: string;
    studentAccountId: string;
    startDate: Date;
    endDate: Date;
  }) => Promise<MarkedAssessment[]>;
  attendanceCounts: (input: {
    classId: string;
    studentAccountId: string;
    startDate: Date;
    endDate: Date;
  }) => Promise<Record<string, number>>;
  /** Replaces any current card for the pupil and term, recording what it replaced. */
  issue: (
    cards: {
      termId: string;
      classId: string;
      studentAccountId: string;
      snapshot: unknown;
      comment: string | null;
      issuedByAccountId: string;
    }[],
  ) => Promise<void>;
  listForClass: (termId: string, classId: string) => Promise<CardRow[]>;
  listForPupil: (studentAccountId: string) => Promise<CardRow[]>;
}

const TERM_SELECT = {
  id: true,
  schoolId: true,
  name: true,
  startDate: true,
  endDate: true,
  _count: { select: { reportCards: true } },
} as const;

function toTerm(raw: {
  id: string;
  schoolId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  _count: { reportCards: number };
}): TermRow {
  return {
    id: raw.id,
    schoolId: raw.schoolId,
    name: raw.name,
    startDate: raw.startDate,
    endDate: raw.endDate,
    // Frozen once anything has been issued against it: the dates are printed on documents families
    // hold, and moving them afterwards would change what those documents claim.
    frozen: raw._count.reportCards > 0,
  };
}

const CARD_SELECT = {
  id: true,
  termId: true,
  classId: true,
  studentAccountId: true,
  issuedAt: true,
  replacedIssuedAt: true,
  comment: true,
  snapshot: true,
  term: { select: { name: true } },
  student: { select: { userProfile: { select: { fullName: true } } } },
} as const;

interface RawCard {
  id: string;
  termId: string;
  classId: string;
  studentAccountId: string;
  issuedAt: Date;
  replacedIssuedAt: Date | null;
  comment: string | null;
  snapshot: unknown;
  term: { name: string } | null;
  student: { userProfile: { fullName: string } | null } | null;
}

function toCard(raw: RawCard): CardRow {
  return {
    id: raw.id,
    termId: raw.termId,
    termName: raw.term?.name ?? '',
    classId: raw.classId,
    studentAccountId: raw.studentAccountId,
    studentName: raw.student?.userProfile?.fullName ?? '',
    issuedAt: raw.issuedAt,
    replacedIssuedAt: raw.replacedIssuedAt,
    comment: raw.comment,
    snapshot: raw.snapshot,
  };
}

export function createReportCardsRepository(db: Db): ReportCardsRepository {
  return {
    createTerm: async (input) => {
      const row = await db.term.create({ data: input, select: TERM_SELECT });
      return toTerm(row);
    },

    listTerms: async (schoolId) => {
      const rows = await db.term.findMany({
        where: { schoolId },
        select: TERM_SELECT,
        orderBy: { startDate: 'desc' },
      });
      return rows.map(toTerm);
    },

    findTerm: async (termId) => {
      const row = await db.term.findUnique({ where: { id: termId }, select: TERM_SELECT });
      return row ? toTerm(row) : null;
    },

    overlappingTerm: async (schoolId, startDate, endDate) => {
      // Two ranges overlap when each starts before the other ends. Inclusive on both sides,
      // because a term ending on the day another starts is two terms claiming the same day.
      const row = await db.term.findFirst({
        where: { schoolId, startDate: { lte: endDate }, endDate: { gte: startDate } },
        select: TERM_SELECT,
      });
      return row ? toTerm(row) : null;
    },

    markedAssessmentsFor: async ({ classId, studentAccountId, startDate, endDate }) => {
      const rows = await db.assessment.findMany({
        where: {
          classId,
          deletedAt: null,
          publishedAt: { not: null },
          occurredOn: { gte: startDate, lte: endDate },
        },
        select: {
          title: true,
          occurredOn: true,
          maxScore: true,
          subject: { select: { name: true } },
          marks: { where: { studentAccountId }, select: { score: true } },
        },
        orderBy: { occurredOn: 'asc' },
      });

      return rows.map((row) => ({
        subjectName: row.subject?.name ?? '',
        title: row.title,
        occurredOn: row.occurredOn,
        maxScore: row.maxScore.toString(),
        score: row.marks[0]?.score?.toString() ?? null,
      }));
    },

    attendanceCounts: async ({ classId, studentAccountId, startDate, endDate }) => {
      const rows = await db.attendanceEntry.groupBy({
        by: ['state'],
        where: { classId, studentAccountId, onDate: { gte: startDate, lte: endDate } },
        _count: { _all: true },
      });

      return Object.fromEntries(rows.map((row) => [row.state, row._count._all]));
    },

    issue: async (cards) => {
      await db.$transaction(async (tx) => {
        for (const card of cards) {
          const existing = await tx.reportCard.findUnique({
            where: {
              termId_studentAccountId: {
                termId: card.termId,
                studentAccountId: card.studentAccountId,
              },
            },
            select: { issuedAt: true },
          });

          const data = {
            classId: card.classId,
            snapshot: card.snapshot as Prisma.InputJsonValue,
            comment: card.comment,
            issuedAt: new Date(),
            issuedByAccountId: card.issuedByAccountId,
            // The card says on its face that it replaced one, and when that one was issued.
            replacedIssuedAt: existing?.issuedAt ?? null,
          };

          await tx.reportCard.upsert({
            where: {
              termId_studentAccountId: {
                termId: card.termId,
                studentAccountId: card.studentAccountId,
              },
            },
            update: data,
            create: { termId: card.termId, studentAccountId: card.studentAccountId, ...data },
          });

          if (existing) {
            await tx.auditLog.create({
              data: {
                actorAccountId: card.issuedByAccountId,
                action: 'report_card.reissued',
                entity: 'report_card',
                entityId: card.termId,
                metadata: {
                  studentAccountId: card.studentAccountId,
                  replacedIssuedAt: existing.issuedAt.toISOString(),
                },
              },
            });
          }
        }
      });
    },

    listForClass: async (termId, classId) => {
      const rows = await db.reportCard.findMany({
        where: { termId, classId },
        select: CARD_SELECT,
      });
      return rows.map(toCard).sort((a, b) => a.studentName.localeCompare(b.studentName));
    },

    listForPupil: async (studentAccountId) => {
      const rows = await db.reportCard.findMany({
        where: { studentAccountId },
        select: CARD_SELECT,
        orderBy: { issuedAt: 'desc' },
      });
      return rows.map(toCard);
    },
  };
}
