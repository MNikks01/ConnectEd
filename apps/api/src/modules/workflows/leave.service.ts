/**
 * Leave applications (FR-WF-001..006).
 *
 * The first module where **who may decide depends on an allocation, not a role**: a teacher of the
 * school cannot approve a student's leave, only the class teacher of *that* class can, and only
 * the principal decides a teacher's. Both policies existed since S0-7 and had never been reached by
 * a request until now.
 *
 * `kind` is derived from the endpoint and the applicant, never read from the body. It selects the
 * approver, so a client that could set it could choose who gets to say yes.
 */
import {
  assertClassTeacherOf,
  assertParentOfVerifiedChild,
  assertPrincipalOfSchool,
  assertVerifiedMembership,
} from '../../shared/authz/index.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationFailedError,
} from '../../shared/errors/index.js';

import type { LeaveRepository, LeaveRow } from './leave.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { LeaveStatus } from '../../generated/prisma/client.js';
import { classDisplayName } from '@connected/types';

import type { ClassLevel, Medium, Section } from '@connected/types';
import type {
  ApplyForChildLeaveInput,
  ApplyForOwnLeaveInput,
  LeaveApplicationResponse,
  LeaveDecisionInput,
} from '@connected/types';

export interface LeaveService {
  applyForChild: (
    actor: Actor,
    childId: string,
    input: ApplyForChildLeaveInput,
  ) => Promise<LeaveApplicationResponse>;
  applyForSelf: (actor: Actor, input: ApplyForOwnLeaveInput) => Promise<LeaveApplicationResponse>;
  /** The class-teacher queue, plus read-only oversight for the school and its principal. */
  listForClass: (
    actor: Actor,
    classId: string,
    status: LeaveStatus | undefined,
  ) => Promise<{ data: LeaveApplicationResponse[] }>;
  listTeacherLeave: (
    actor: Actor,
    schoolId: string,
    status: LeaveStatus | undefined,
  ) => Promise<{ data: LeaveApplicationResponse[] }>;
  /** The caller's own applications, whoever they are. */
  listMine: (actor: Actor) => Promise<{ data: LeaveApplicationResponse[] }>;
  decide: (
    actor: Actor,
    leaveId: string,
    input: LeaveDecisionInput,
  ) => Promise<LeaveApplicationResponse>;
}

export interface LeaveServiceDeps {
  repository: LeaveRepository;
  db: Db;
  logger: Logger;
}

/** `Date` in, `YYYY-MM-DD` out — a leave day is a calendar day, not an instant. */
function toCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` in, midnight UTC out, which is how Postgres stores a `date`. */
function fromCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function createLeaveService({ repository, db, logger }: LeaveServiceDeps): LeaveService {
  function toResponse(row: LeaveRow): LeaveApplicationResponse {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      schoolId: row.schoolId,
      classId: row.classId,
      className: row.className
        ? classDisplayName({
            medium: row.className.medium as Medium,
            level: row.className.level as ClassLevel,
            section: row.className.section as Section,
          })
        : null,
      childId: row.childId,
      childName: row.childName,
      applicantAccountId: row.applicantAccountId,
      applicantName: row.applicantName,
      startDate: toCalendarDate(row.startDate),
      endDate: toCalendarDate(row.endDate),
      reason: row.reason,
      decidedByAccountId: row.decidedBy,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Oversight (FR-WF-006) is the school itself or its verified principal — read-only, both. */
  async function assertMaySeeSchoolQueue(actor: Actor, schoolId: string): Promise<void> {
    if (actor.accountType === 'SCHOOL') {
      if (actor.accountId !== schoolId) throw new NotFoundError();
      return;
    }

    await assertPrincipalOfSchool(db, actor, schoolId);
  }

  return {
    applyForChild: async (actor, childId, input) => {
      await assertParentOfVerifiedChild(db, actor, childId);

      const child = await db.child.findUnique({
        where: { id: childId },
        select: { schoolId: true, classId: true },
      });

      // `assertParentOfVerifiedChild` has already refused a child with no school, so this is a
      // narrowing rather than a check.
      if (!child?.schoolId) throw new NotFoundError();

      if (!child.classId) {
        // Without a class there is no class teacher, and therefore nobody who could ever decide it.
        throw new ValidationFailedError([
          {
            field: 'childId',
            issue: 'This child is not in a class yet, so leave cannot be applied for.',
          },
        ]);
      }

      const row = await repository.create({
        kind: 'STUDENT',
        schoolId: child.schoolId,
        classId: child.classId,
        childId,
        applicantAccountId: actor.accountId,
        startDate: fromCalendarDate(input.startDate),
        endDate: fromCalendarDate(input.endDate),
        reason: input.reason,
      });

      logger.info({ leaveId: row.id, childId, classId: child.classId }, 'Leave applied for child');

      return toResponse(row);
    },

    applyForSelf: async (actor, input) => {
      // A teacher of *this* school. Not "a teacher somewhere", which would file the application
      // into a principal's queue at a school the applicant has nothing to do with.
      await assertVerifiedMembership(db, actor, input.schoolId, 'TEACHER');

      const row = await repository.create({
        kind: 'TEACHER',
        schoolId: input.schoolId,
        classId: null,
        childId: null,
        applicantAccountId: actor.accountId,
        startDate: fromCalendarDate(input.startDate),
        endDate: fromCalendarDate(input.endDate),
        reason: input.reason,
      });

      logger.info({ leaveId: row.id, schoolId: input.schoolId }, 'Teacher applied for leave');

      return toResponse(row);
    },

    listForClass: async (actor, classId, status) => {
      const klass = await db.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });
      if (!klass) throw new NotFoundError();

      // Either the class teacher who decides these, or oversight that only looks.
      try {
        await assertClassTeacherOf(db, actor, classId);
      } catch (error) {
        if (!(error instanceof ForbiddenError)) throw error;
        await assertMaySeeSchoolQueue(actor, klass.schoolId);
      }

      return { data: (await repository.listForClass(classId, status)).map(toResponse) };
    },

    listTeacherLeave: async (actor, schoolId, status) => {
      await assertMaySeeSchoolQueue(actor, schoolId);

      return {
        data: (await repository.listTeacherLeaveForSchool(schoolId, status)).map(toResponse),
      };
    },

    /** Scoped to the caller by the query, so there is no path to someone else's applications. */
    listMine: async (actor) => ({
      data: (await repository.listForApplicant(actor.accountId)).map(toResponse),
    }),

    decide: async (actor, leaveId, input) => {
      const existing = await repository.findById(leaveId);
      if (!existing) throw new NotFoundError();

      if (existing.kind === 'STUDENT') {
        if (!existing.classId) throw new NotFoundError();
        // The class teacher of *that* class. A teacher of the school, or the class teacher of a
        // different class, is refused here — this is the rule the whole feature turns on.
        await assertClassTeacherOf(db, actor, existing.classId);
      } else {
        await assertPrincipalOfSchool(db, actor, existing.schoolId);
      }

      const status: LeaveStatus = input.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
      const decided = await repository.decide(
        { id: leaveId, status, decidedBy: actor.accountId },
        (row) => ({
          type: 'leave.decided',
          leaveId,
          applicantAccountId: row.applicantAccountId,
          schoolId: row.schoolId,
          kind: row.kind,
          status,
        }),
      );

      if (!decided) {
        // Already decided. 409 rather than a silent overwrite: the second approver needs to know
        // their decision did not take effect.
        throw new ConflictError('This application has already been decided.');
      }

      await db.auditLog.create({
        data: {
          actorAccountId: actor.accountId,
          action: `leave.${status.toLowerCase()}`,
          entity: 'leave_application',
          entityId: leaveId,
          metadata: {
            kind: decided.kind,
            applicantAccountId: decided.applicantAccountId,
            ...(decided.classId ? { classId: decided.classId } : {}),
            ...(input.note ? { note: input.note } : {}),
          },
        },
      });

      logger.info({ leaveId, status, accountId: actor.accountId }, 'Leave decided');

      return toResponse(decided);
    },
  };
}
