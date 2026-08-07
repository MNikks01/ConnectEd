/**
 * Gradebook — assessments and marks (`.docs/PRD/11-gradebook.md`).
 *
 * **This module's authorization is different in kind from everything before it.** Elsewhere the
 * question is "are you a verified member of this class", and the answer admits the whole class. A
 * mark is a fact about one child, so membership is necessary and nowhere near sufficient: a
 * classmate is a verified member of exactly the same class and must see nothing.
 *
 * So every read here answers *which pupil*, not merely *which class*, and the negative tests are
 * the feature.
 */
import {
  assertIsSchool,
  assertParentOfVerifiedChild,
  assertTeacherAllocatedToSubject,
  assertVerifiedMembership,
} from '../../shared/authz/index.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/index.js';

import type { Actor } from '../../shared/authz/index.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { AssessmentRow, GradebookRepository, MarkRow } from './gradebook.repository.js';
import type {
  AssessmentResponse,
  AssessmentWithMarksResponse,
  CorrectMarkInput,
  CreateAssessmentInput,
  EnterMarksInput,
  MyMarkResponse,
} from '@connected/types';

export interface GradebookService {
  createAssessment: (
    actor: Actor,
    classId: string,
    input: CreateAssessmentInput,
  ) => Promise<AssessmentResponse>;
  enterMarks: (actor: Actor, assessmentId: string, input: EnterMarksInput) => Promise<void>;
  publish: (actor: Actor, assessmentId: string) => Promise<AssessmentResponse>;
  correctMark: (
    actor: Actor,
    assessmentId: string,
    studentAccountId: string,
    input: CorrectMarkInput,
  ) => Promise<MarkRow>;
  /**
   * The assessments of a class, for the people who mark or oversee them.
   *
   * Not for pupils or parents: they read `/me/...` and `/children/...`, which are scoped to one
   * pupil and carry their mark. This list carries none.
   */
  listAssessments: (actor: Actor, classId: string) => Promise<AssessmentResponse[]>;
  /** The marking view: every pupil's mark for one assessment. Never a pupil's own view. */
  listMarks: (actor: Actor, assessmentId: string) => Promise<AssessmentWithMarksResponse>;
  /** A pupil reading their own. */
  listMine: (actor: Actor, classId: string) => Promise<MyMarkResponse[]>;
  /** A parent reading one child's. */
  listForChild: (actor: Actor, childId: string) => Promise<MyMarkResponse[]>;
  removeAssessment: (actor: Actor, assessmentId: string) => Promise<void>;
}

export interface GradebookServiceDeps {
  repository: GradebookRepository;
  db: Db;
  logger: Logger;
}

function toResponse(row: AssessmentRow): AssessmentResponse {
  return {
    id: row.id,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    classId: row.classId,
    kind: row.kind,
    title: row.title,
    maxScore: row.maxScore,
    occurredOn: row.occurredOn.toISOString().slice(0, 10),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createGradebookService({
  repository,
  db,
  logger,
}: GradebookServiceDeps): GradebookService {
  /** Loads an assessment the actor is allowed to mark: its teacher, or the school. */
  async function loadForMarking(actor: Actor, assessmentId: string): Promise<AssessmentRow> {
    const assessment = await repository.findAssessment(assessmentId);
    if (!assessment) throw new NotFoundError();

    // Both paths end in a check against the *subject*, not the class: a teacher of another subject
    // in the same class is not entitled to these marks (FR-GRADE-022).
    await assertTeacherAllocatedToSubject(db, actor, assessment.subjectId);

    return assessment;
  }

  /**
   * The cross-subject readers: the class teacher for their class, the principal and school for
   * theirs. Published marks only — an unpublished mark is not a fact yet (FR-GRADE-023).
   */
  async function assertMaySeeWholeClass(actor: Actor, assessment: AssessmentRow): Promise<void> {
    const klass = await db.class.findUnique({
      where: { id: assessment.classId },
      select: { schoolId: true },
    });
    if (!klass) throw new NotFoundError();

    if (actor.accountType === 'SCHOOL') {
      assertIsSchool(actor, klass.schoolId);
      return;
    }

    const classTeacher = await db.classTeacher.findUnique({
      where: { classId: assessment.classId },
      select: { teacher: { select: { accountId: true } } },
    });

    if (classTeacher?.teacher.accountId === actor.accountId) {
      await assertVerifiedMembership(db, actor, klass.schoolId, 'TEACHER');
      return;
    }

    await assertVerifiedMembership(db, actor, klass.schoolId, 'PRINCIPAL');
  }

  /** Everything a pupil account may read for a class: published assessments, and its own mark. */
  async function marksForPupil(pupilAccountId: string, classId: string): Promise<MyMarkResponse[]> {
    const assessments = await repository.listForClass(classId, { publishedOnly: true });

    return Promise.all(
      assessments.map(async (assessment) => ({
        ...toResponse(assessment),
        mark: await repository.findMark(assessment.id, pupilAccountId),
      })),
    );
  }

  return {
    createAssessment: async (actor, classId, input) => {
      // The subject must belong to this class, or a teacher allocated in class A could create an
      // assessment in class B by naming A's subject — the same hole FR-ACAD-001 closes.
      const subject = await db.subject.findUnique({
        where: { id: input.subjectId },
        select: { classId: true },
      });
      if (!subject || subject.classId !== classId) {
        throw new NotFoundError('That subject is not part of this class.');
      }

      await assertTeacherAllocatedToSubject(db, actor, input.subjectId);

      const assessment = await repository.createAssessment({
        subjectId: input.subjectId,
        classId,
        kind: input.kind,
        title: input.title,
        maxScore: input.maxScore,
        occurredOn: new Date(`${input.occurredOn}T00:00:00.000Z`),
        authorAccountId: actor.accountId,
      });

      logger.info({ assessmentId: assessment.id, classId }, 'Assessment created');

      return toResponse(assessment);
    },

    enterMarks: async (actor, assessmentId, input) => {
      const assessment = await loadForMarking(actor, assessmentId);

      if (assessment.publishedAt) {
        // Published marks are corrected one at a time, and audited. A bulk overwrite of published
        // results would leave no record of what changed for whom.
        throw new ConflictError(
          'These marks are published. Correct them individually so the change is recorded.',
        );
      }

      const roster = new Set(await repository.listClassStudentAccountIds(assessment.classId));
      for (const mark of input.marks) {
        if (!roster.has(mark.studentAccountId)) {
          // Not merely tidiness: without this a teacher could write a mark against any account in
          // the product, and that mark would then be readable by that account's parent.
          throw new NotFoundError('One of those pupils is not a verified student of this class.');
        }
      }

      await repository.enterMarks(assessmentId, input.marks);

      logger.info({ assessmentId, count: input.marks.length }, 'Marks entered as draft');
    },

    publish: async (actor, assessmentId) => {
      const assessment = await loadForMarking(actor, assessmentId);

      if (assessment.publishedAt) {
        throw new ConflictError('These marks are already published.');
      }

      const published = await repository.publish(assessmentId, (row) => ({
        type: 'marks.published',
        assessmentId: row.id,
        classId: row.classId,
        subjectId: row.subjectId,
        title: row.title,
      }));

      logger.info({ assessmentId, classId: assessment.classId }, 'Marks published');

      return toResponse(published);
    },

    correctMark: async (actor, assessmentId, studentAccountId, input) => {
      const assessment = await loadForMarking(actor, assessmentId);

      const previous = await repository.findMark(assessmentId, studentAccountId);
      if (!previous) throw new NotFoundError();

      const corrected = await repository.correctMark({
        assessmentId,
        studentAccountId,
        score: input.score,
        remark: input.remark,
        previous: { score: previous.score, remark: previous.remark },
        actorAccountId: actor.accountId,
      });

      logger.info(
        { assessmentId, studentAccountId, published: assessment.publishedAt !== null },
        'Mark corrected',
      );

      return corrected;
    },

    listAssessments: async (actor, classId) => {
      const klass = await db.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });
      if (!klass) throw new NotFoundError();

      // The school sees everything, drafts included — it owns the data and must be able to take
      // over from a teacher who has left (`PRD/11-gradebook.md`). Handled before the allocation
      // lookup because a school holds no subject allocations, so it would otherwise fall through to
      // the published-only branch — and `listMarks` *does* give it drafts, which left the two
      // endpoints disagreeing: a draft it could open by id and never see listed.
      if (actor.accountType === 'SCHOOL') {
        assertIsSchool(actor, klass.schoolId);
        return (await repository.listForClass(classId, { publishedOnly: false })).map(toResponse);
      }

      // A teacher of this class sees their own subjects' assessments, drafts included, plus the
      // published ones from other subjects. Everyone else with a claim sees published only.
      const mine = await db.subjectAllocation.findMany({
        where: {
          teacher: { accountId: actor.accountId, schoolId: klass.schoolId },
          subject: { classId },
        },
        select: { subjectId: true },
      });

      if (mine.length > 0) {
        await assertVerifiedMembership(db, actor, klass.schoolId, 'TEACHER');

        const ownSubjects = new Set(mine.map((allocation) => allocation.subjectId));
        const own = await Promise.all(
          [...ownSubjects].map((subjectId) => repository.listForSubject(subjectId)),
        );
        const othersPublished = (
          await repository.listForClass(classId, { publishedOnly: true })
        ).filter((assessment) => !ownSubjects.has(assessment.subjectId));

        return [...own.flat(), ...othersPublished]
          .sort((a, b) => b.occurredOn.getTime() - a.occurredOn.getTime())
          .map(toResponse);
      }

      await assertMaySeeWholeClass(actor, { classId } as AssessmentRow);

      return (await repository.listForClass(classId, { publishedOnly: true })).map(toResponse);
    },

    listMarks: async (actor, assessmentId) => {
      const assessment = await repository.findAssessment(assessmentId);
      if (!assessment) throw new NotFoundError();

      // The subject's own teacher sees drafts; everyone else with a claim sees published only.
      try {
        await assertTeacherAllocatedToSubject(db, actor, assessment.subjectId);
      } catch {
        await assertMaySeeWholeClass(actor, assessment);

        if (!assessment.publishedAt) {
          // Not 403: an unpublished assessment is not yet something these readers have.
          throw new NotFoundError();
        }
      }

      // Every pupil on the roster appears, marked or not (FR-GRADE-003). A grid that showed only
      // the pupils already marked would hide exactly the ones a teacher still has to do — and
      // "not marked" is a state this product is careful to keep distinct from zero.
      const [roster, marks] = await Promise.all([
        repository.listClassStudents(assessment.classId),
        repository.listMarks(assessmentId),
      ]);

      const byPupil = new Map(marks.map((mark) => [mark.studentAccountId, mark]));

      return {
        ...toResponse(assessment),
        marks: roster.map(
          (pupil) =>
            byPupil.get(pupil.accountId) ?? {
              studentAccountId: pupil.accountId,
              studentName: pupil.name,
              score: null,
              remark: null,
            },
        ),
      };
    },

    listMine: async (actor, classId) => {
      if (actor.accountType === 'SCHOOL') {
        throw new ForbiddenError('A school account has no marks of its own.');
      }

      const klass = await db.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });
      if (!klass) throw new NotFoundError();

      // Their own STUDENT membership in this class, and nothing weaker. A parent or teacher asking
      // for "my marks" has none, and must not fall through to somebody else's.
      const membership = await db.membership.findFirst({
        where: {
          accountId: actor.accountId,
          classId,
          role: 'STUDENT',
          status: 'VERIFIED',
        },
        select: { id: true },
      });
      if (!membership) throw new NotFoundError();

      return marksForPupil(actor.accountId, classId);
    },

    listForChild: async (actor, childId) => {
      await assertParentOfVerifiedChild(db, actor, childId);

      const pupilAccountId = await repository.pupilAccountForChild(childId);
      if (!pupilAccountId) {
        // The school has not confirmed which pupil this child is (FR-GRADE-005). Refusing is the
        // only safe answer: guessing by name or class would be how one family sees another's marks.
        throw new NotFoundError(
          'Your school has not yet linked this child to their student account.',
        );
      }

      const child = await db.child.findUniqueOrThrow({
        where: { id: childId },
        select: { classId: true },
      });
      if (!child.classId) throw new NotFoundError();

      return marksForPupil(pupilAccountId, child.classId);
    },

    removeAssessment: async (actor, assessmentId) => {
      const assessment = await repository.findAssessment(assessmentId);
      if (!assessment) throw new NotFoundError();

      await assertTeacherAllocatedToSubject(db, actor, assessment.subjectId);

      await repository.softDeleteAssessment(assessmentId);
      logger.info({ assessmentId }, 'Assessment deleted');
    },
  };
}
