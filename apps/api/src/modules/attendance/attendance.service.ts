/**
 * Attendance — a register per class per day (`.docs/PRD/12-attendance.md`).
 *
 * The gradebook's visibility rules, reused almost unchanged, with one deliberate difference: a
 * register is a **class-level** fact, so any teacher who teaches the class reads the whole thing.
 * Marks are subject-scoped because a mark is about a subject; knowing who is in the room is part of
 * teaching it whatever you teach.
 *
 * Taking one is narrower than reading it: the class teacher, or the school. FR-INST-004 already
 * makes the class teacher the person who answers for the class, and two people taking the same
 * register is how a class ends up with two answers about the same child.
 */
import {
  assertIsSchool,
  assertParentOfVerifiedChild,
  assertVerifiedMembership,
} from '../../shared/authz/index.js';
import { ForbiddenError, NotFoundError, ValidationFailedError } from '../../shared/errors/index.js';

import type { Actor } from '../../shared/authz/index.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { AttendanceRepository } from './attendance.repository.js';
import type { MyAttendanceResponse, RegisterResponse, TakeRegisterInput } from '@connected/types';

export interface AttendanceService {
  /** The register for a date, pre-filled from accepted leave where nobody has taken it yet. */
  getRegister: (actor: Actor, classId: string, onDate: string) => Promise<RegisterResponse>;
  takeRegister: (actor: Actor, classId: string, input: TakeRegisterInput) => Promise<void>;
  listMine: (actor: Actor, classId: string) => Promise<MyAttendanceResponse[]>;
  listForChild: (actor: Actor, childId: string) => Promise<MyAttendanceResponse[]>;
}

export interface AttendanceServiceDeps {
  repository: AttendanceRepository;
  db: Db;
  logger: Logger;
  /** Injected so tests can fix "today" — FR-ATT-005 refuses a future date. */
  now?: (() => Date) | undefined;
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationFailedError([{ field: 'onDate', issue: 'That is not a date.' }]);
  }
  return parsed;
}

export function createAttendanceService({
  repository,
  db,
  logger,
  now = () => new Date(),
}: AttendanceServiceDeps): AttendanceService {
  async function schoolIdOf(classId: string): Promise<string> {
    const klass = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!klass) throw new NotFoundError();
    return klass.schoolId;
  }

  /** Reading: any teacher of the class, the class teacher, the principal, or the school. */
  async function assertMayRead(actor: Actor, classId: string): Promise<void> {
    const schoolId = await schoolIdOf(classId);

    if (actor.accountType === 'SCHOOL') {
      assertIsSchool(actor, schoolId);
      return;
    }

    const teaches = await db.subjectAllocation.findFirst({
      where: { teacher: { accountId: actor.accountId, schoolId }, subject: { classId } },
      select: { id: true },
    });

    if (teaches) {
      await assertVerifiedMembership(db, actor, schoolId, 'TEACHER');
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

  /** Taking: the class teacher of this class, or the school. Narrower than reading, deliberately. */
  async function assertMayTake(actor: Actor, classId: string): Promise<void> {
    const schoolId = await schoolIdOf(classId);

    if (actor.accountType === 'SCHOOL') {
      assertIsSchool(actor, schoolId);
      return;
    }

    const classTeacher = await db.classTeacher.findUnique({
      where: { classId },
      select: { teacher: { select: { accountId: true } } },
    });

    if (classTeacher?.teacher.accountId !== actor.accountId) {
      throw new ForbiddenError('Only this class’s teacher takes its register.');
    }

    await assertVerifiedMembership(db, actor, schoolId, 'TEACHER');
  }

  return {
    getRegister: async (actor, classId, onDate) => {
      await assertMayRead(actor, classId);

      const date = parseDate(onDate);
      const [pupils, existing, takenAt, leave] = await Promise.all([
        repository.listClassPupils(classId),
        repository.findRegister(classId, date),
        repository.registerTakenAt(classId, date),
        repository.acceptedLeaveOn(classId, date),
      ]);

      const taken = new Map(existing.map((entry) => [entry.studentAccountId, entry]));

      return {
        classId,
        onDate,
        takenAt: takenAt?.toISOString() ?? null,
        entries: pupils.map((pupil) => {
          const already = taken.get(pupil.accountId);
          if (already) return already;

          // Not yet taken: offer what the school already decided. An accepted leave covering this
          // date makes EXCUSED the honest default (FR-ATT-010) — the alternative is a school
          // marking a child absent on a day it agreed they could be away.
          const excused = leave.has(pupil.accountId);

          return {
            studentAccountId: pupil.accountId,
            studentName: pupil.name,
            state: excused ? ('EXCUSED' as const) : ('PRESENT' as const),
            fromLeave: excused,
          };
        }),
      };
    },

    takeRegister: async (actor, classId, input) => {
      await assertMayTake(actor, classId);

      const date = parseDate(input.onDate);

      // Tomorrow's attendance is not a fact (FR-ATT-005). Compared on the date alone, so a register
      // taken at 09:00 for today is not refused by a UTC clock that has not caught up.
      const today = now().toISOString().slice(0, 10);
      if (input.onDate > today) {
        throw new ValidationFailedError([
          { field: 'onDate', issue: 'A register cannot be taken for a future date.' },
        ]);
      }

      const roster = new Set(
        (await repository.listClassPupils(classId)).map((pupil) => pupil.accountId),
      );

      for (const entry of input.entries) {
        if (!roster.has(entry.studentAccountId)) {
          throw new NotFoundError('One of those pupils is not a verified student of this class.');
        }
      }

      const [existing, leave] = await Promise.all([
        repository.findRegister(classId, date),
        repository.acceptedLeaveOn(classId, date),
      ]);

      await repository.takeRegister({
        classId,
        onDate: date,
        takenByAccountId: actor.accountId,
        entries: input.entries.map((entry) => ({
          studentAccountId: entry.studentAccountId,
          state: entry.state,
          // The leave is recorded only when it agrees with what was submitted, so the screen can
          // say "excused — leave accepted" truthfully and never against a teacher's override.
          ...(entry.state === 'EXCUSED' && leave.has(entry.studentAccountId)
            ? { leaveApplicationId: leave.get(entry.studentAccountId) }
            : {}),
        })),
        previous: new Map(existing.map((entry) => [entry.studentAccountId, entry.state])),
      });

      logger.info(
        { classId, onDate: input.onDate, pupils: input.entries.length },
        'Register taken',
      );
    },

    listMine: async (actor, classId) => {
      if (actor.accountType === 'SCHOOL') {
        throw new ForbiddenError('A school account has no attendance of its own.');
      }

      const membership = await db.membership.findFirst({
        where: { accountId: actor.accountId, classId, role: 'STUDENT', status: 'VERIFIED' },
        select: { id: true },
      });
      if (!membership) throw new NotFoundError();

      return (await repository.listForPupil(actor.accountId, classId)).map((row) => ({
        onDate: row.onDate.toISOString().slice(0, 10),
        state: row.state,
        fromLeave: row.fromLeave,
      }));
    },

    listForChild: async (actor, childId) => {
      await assertParentOfVerifiedChild(db, actor, childId);

      const child = await db.child.findUniqueOrThrow({
        where: { id: childId },
        select: { classId: true, studentAccountId: true },
      });

      if (!child.studentAccountId || !child.classId) {
        // Same refusal as the gradebook: guessing which pupil this child is would be how one
        // family reads another's record.
        throw new NotFoundError(
          'Your school has not yet linked this child to their student account.',
        );
      }

      return (await repository.listForPupil(child.studentAccountId, child.classId)).map((row) => ({
        onDate: row.onDate.toISOString().slice(0, 10),
        state: row.state,
        fromLeave: row.fromLeave,
      }));
    },
  };
}
