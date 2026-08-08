/**
 * Terms and report cards (`.docs/PRD/13-report-cards.md`).
 *
 * **A card is issued, not rendered.** Every number is computed once, at issue, and stored. A
 * correction to a mark afterwards leaves the card alone — a family keeps the document they were
 * given, and a document that rewrites itself is not one.
 *
 * The arithmetic carries one rule through from the gradebook: an assessment a pupil was not marked
 * for is excluded from **both** sides of the total. Counting it as zero would punish a child twice
 * for being absent — once by missing the test, once by the average.
 */
import {
  assertIsSchool,
  assertParentOfVerifiedChild,
  assertVerifiedMemberOfSchool,
  assertVerifiedMembership,
} from '../../shared/authz/index.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/index.js';

import type { Actor } from '../../shared/authz/index.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type {
  CardRow,
  MarkedAssessment,
  ReportCardsRepository,
  TermRow,
} from './reportcards.repository.js';
import type {
  CreateTermInput,
  IssueReportCardsInput,
  ReportCardResponse,
  ReportCardSnapshot,
  TermResponse,
} from '@connected/types';

export interface ReportCardsService {
  createTerm: (actor: Actor, schoolId: string, input: CreateTermInput) => Promise<TermResponse>;
  listTerms: (actor: Actor, schoolId: string) => Promise<TermResponse[]>;
  issue: (actor: Actor, classId: string, input: IssueReportCardsInput) => Promise<void>;
  listForClass: (actor: Actor, classId: string, termId: string) => Promise<ReportCardResponse[]>;
  listMine: (actor: Actor) => Promise<ReportCardResponse[]>;
  listForChild: (actor: Actor, childId: string) => Promise<ReportCardResponse[]>;
}

export interface ReportCardsServiceDeps {
  repository: ReportCardsRepository;
  db: Db;
  logger: Logger;
}

function toTermResponse(row: TermRow): TermResponse {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    frozen: row.frozen,
  };
}

function toCardResponse(row: CardRow): ReportCardResponse {
  return {
    id: row.id,
    termId: row.termId,
    termName: row.termName,
    classId: row.classId,
    studentAccountId: row.studentAccountId,
    studentName: row.studentName,
    issuedAt: row.issuedAt.toISOString(),
    replacedIssuedAt: row.replacedIssuedAt?.toISOString() ?? null,
    comment: row.comment,
    snapshot: row.snapshot as ReportCardSnapshot,
  };
}

/**
 * The card's arithmetic, in one place so it can be read as a whole.
 *
 * Scores are strings end to end and are summed as numbers only here, on values already bounded by
 * `decimal(6,2)`. Totals are rounded to two places on the way out so that 88.33333… never reaches a
 * parent.
 */
function buildSnapshot(
  assessments: MarkedAssessment[],
  attendance: Record<string, number>,
): ReportCardSnapshot {
  const bySubject = new Map<string, MarkedAssessment[]>();

  for (const assessment of assessments) {
    const list = bySubject.get(assessment.subjectName) ?? [];
    list.push(assessment);
    bySubject.set(assessment.subjectName, list);
  }

  let overallScored = 0;
  let overallAvailable = 0;

  const subjects = [...bySubject.entries()].map(([subjectName, list]) => {
    let scored = 0;
    let available = 0;

    for (const assessment of list) {
      // The rule that matters. A pupil who was not marked contributes nothing to either side —
      // not a zero on top and not a maximum underneath.
      if (assessment.score === null) continue;
      scored += Number(assessment.score);
      available += Number(assessment.maxScore);
    }

    overallScored += scored;
    overallAvailable += available;

    return {
      subjectName,
      assessments: list.map((assessment) => ({
        title: assessment.title,
        occurredOn: assessment.occurredOn.toISOString().slice(0, 10),
        score: assessment.score,
        maxScore: assessment.maxScore,
      })),
      scored: scored.toFixed(2),
      available: available.toFixed(2),
      // Null rather than 0 when nothing counted: a pupil with no marks has no percentage, and
      // printing 0% would say something false about them.
      percent: available > 0 ? Math.round((scored / available) * 100) : null,
    };
  });

  return {
    subjects,
    attendance: {
      present: attendance.PRESENT ?? 0,
      absent: attendance.ABSENT ?? 0,
      late: attendance.LATE ?? 0,
      excused: attendance.EXCUSED ?? 0,
    },
    overallPercent:
      overallAvailable > 0 ? Math.round((overallScored / overallAvailable) * 100) : null,
  };
}

export function createReportCardsService({
  repository,
  db,
  logger,
}: ReportCardsServiceDeps): ReportCardsService {
  async function schoolIdOf(classId: string): Promise<string> {
    const klass = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!klass) throw new NotFoundError();
    return klass.schoolId;
  }

  /** Issuing: the class teacher of this class, or the school. Same as taking a register. */
  async function assertMayIssue(actor: Actor, classId: string): Promise<string> {
    const schoolId = await schoolIdOf(classId);

    if (actor.accountType === 'SCHOOL') {
      assertIsSchool(actor, schoolId);
      return schoolId;
    }

    const classTeacher = await db.classTeacher.findUnique({
      where: { classId },
      select: { teacher: { select: { accountId: true } } },
    });

    if (classTeacher?.teacher.accountId !== actor.accountId) {
      throw new ForbiddenError('Only this class’s teacher issues its report cards.');
    }

    await assertVerifiedMembership(db, actor, schoolId, 'TEACHER');
    return schoolId;
  }

  /**
   * Reading a whole class's cards: the class teacher, the principal, or the school.
   *
   * **A subject teacher is refused**, unlike marks. A card spans a child's whole term, and teaching
   * them one subject is not a reason to read the rest.
   */
  async function assertMayReadClass(actor: Actor, classId: string): Promise<void> {
    const schoolId = await schoolIdOf(classId);

    if (actor.accountType === 'SCHOOL') {
      assertIsSchool(actor, schoolId);
      return;
    }

    const classTeacher = await db.classTeacher.findUnique({
      where: { classId },
      select: { teacher: { select: { accountId: true } } },
    });

    if (classTeacher?.teacher.accountId === actor.accountId) {
      await assertVerifiedMembership(db, actor, schoolId, 'TEACHER');
      return;
    }

    await assertVerifiedMembership(db, actor, schoolId, 'PRINCIPAL');
  }

  return {
    createTerm: async (actor, schoolId, input) => {
      assertIsSchool(actor, schoolId);

      const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
      const endDate = new Date(`${input.endDate}T00:00:00.000Z`);

      const clash = await repository.overlappingTerm(schoolId, startDate, endDate);
      if (clash) {
        // An assessment must belong to one term or none. Overlapping terms would put the same
        // assessment on two cards with different names.
        throw new ConflictError(`Those dates overlap “${clash.name}”.`);
      }

      const term = await repository.createTerm({ schoolId, name: input.name, startDate, endDate });
      logger.info({ termId: term.id, schoolId }, 'Term created');

      return toTermResponse(term);
    },

    listTerms: async (actor, schoolId) => {
      // Wider than defining one, and it has to be: issuing names a term, and the class teacher who
      // issues is not the school. Gating the list on `assertIsSchool` left the person the feature
      // is for unable to see the only thing they are allowed to choose from — a server that says
      // yes to the action and no to the list it needs.
      //
      // The reach is small: a term is a name and two dates, and it is printed on every card a
      // family already holds.
      await assertVerifiedMemberOfSchool(db, actor, schoolId);
      return (await repository.listTerms(schoolId)).map(toTermResponse);
    },

    issue: async (actor, classId, input) => {
      await assertMayIssue(actor, classId);

      const term = await repository.findTerm(input.termId);
      if (!term) throw new NotFoundError();

      const schoolId = await schoolIdOf(classId);
      if (term.schoolId !== schoolId) {
        throw new NotFoundError('That term is not this school’s.');
      }

      const pupils = await db.membership.findMany({
        where: { classId, role: 'STUDENT', status: 'VERIFIED' },
        select: { accountId: true },
      });

      if (pupils.length === 0) {
        throw new ConflictError('This class has no verified pupils, so there is nothing to issue.');
      }

      // Built one pupil at a time and written in one transaction: a term where half the class has a
      // card is a term nobody can explain (FR-GRADE-040).
      const cards = await Promise.all(
        pupils.map(async ({ accountId }) => {
          const [assessments, attendance] = await Promise.all([
            repository.markedAssessmentsFor({
              classId,
              studentAccountId: accountId,
              startDate: term.startDate,
              endDate: term.endDate,
            }),
            repository.attendanceCounts({
              classId,
              studentAccountId: accountId,
              startDate: term.startDate,
              endDate: term.endDate,
            }),
          ]);

          return {
            termId: term.id,
            classId,
            studentAccountId: accountId,
            snapshot: buildSnapshot(assessments, attendance),
            comment: input.comments?.[accountId] ?? null,
            issuedByAccountId: actor.accountId,
          };
        }),
      );

      await repository.issue(cards);

      logger.info({ classId, termId: term.id, cards: cards.length }, 'Report cards issued');
    },

    listForClass: async (actor, classId, termId) => {
      await assertMayReadClass(actor, classId);
      return (await repository.listForClass(termId, classId)).map(toCardResponse);
    },

    listMine: async (actor) => {
      if (actor.accountType === 'SCHOOL') {
        throw new ForbiddenError('A school account has no report cards of its own.');
      }

      return (await repository.listForPupil(actor.accountId)).map(toCardResponse);
    },

    listForChild: async (actor, childId) => {
      await assertParentOfVerifiedChild(db, actor, childId);

      const child = await db.child.findUniqueOrThrow({
        where: { id: childId },
        select: { studentAccountId: true },
      });

      if (!child.studentAccountId) {
        throw new NotFoundError(
          'Your school has not yet linked this child to their student account.',
        );
      }

      return (await repository.listForPupil(child.studentAccountId)).map(toCardResponse);
    },
  };
}
