/**
 * Attendance persistence. **The only file in this module that touches Prisma.**
 */
import type { Db } from '../../shared/db/index.js';
import type { AttendanceState } from '../../generated/prisma/client.js';

export interface EntryRow {
  studentAccountId: string;
  studentName: string;
  state: AttendanceState;
  fromLeave: boolean;
}

export interface PupilDayRow {
  onDate: Date;
  state: AttendanceState;
  fromLeave: boolean;
}

export interface AttendanceRepository {
  /** The class's verified pupils — who a register is about (FR-ATT-001). */
  listClassPupils: (classId: string) => Promise<{ accountId: string; name: string }[]>;
  /**
   * Accepted leave covering a date, for the pupils of a class.
   *
   * Returns a map from pupil account to the leave that covers them. A parent applies naming a
   * **child**, so the join runs through `Child.studentAccountId` — the link the school confirms —
   * and a student applying for themselves is matched on their own account.
   */
  acceptedLeaveOn: (classId: string, onDate: Date) => Promise<Map<string, string>>;
  findRegister: (classId: string, onDate: Date) => Promise<EntryRow[]>;
  registerTakenAt: (classId: string, onDate: Date) => Promise<Date | null>;
  /** Upserts the whole register in one transaction, auditing whatever it changed. */
  takeRegister: (input: {
    classId: string;
    onDate: Date;
    takenByAccountId: string;
    entries: { studentAccountId: string; state: AttendanceState; leaveApplicationId?: string }[];
    previous: Map<string, AttendanceState>;
  }) => Promise<void>;
  listForPupil: (studentAccountId: string, classId: string) => Promise<PupilDayRow[]>;
}

export function createAttendanceRepository(db: Db): AttendanceRepository {
  return {
    listClassPupils: async (classId) => {
      const rows = await db.membership.findMany({
        where: { classId, role: 'STUDENT', status: 'VERIFIED' },
        select: { account: { select: { id: true, userProfile: { select: { fullName: true } } } } },
      });

      return rows
        .map((row) => ({
          accountId: row.account.id,
          name: row.account.userProfile?.fullName ?? '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    acceptedLeaveOn: async (classId, onDate) => {
      const leaves = await db.leaveApplication.findMany({
        where: {
          status: 'ACCEPTED',
          startDate: { lte: onDate },
          endDate: { gte: onDate },
          OR: [
            // A student applying for themselves.
            { applicantAccountId: { not: undefined }, classId },
            // A parent applying for a child — resolved through the school-confirmed pupil link.
            { child: { classId, studentAccountId: { not: null } } },
          ],
        },
        select: {
          id: true,
          applicantAccountId: true,
          child: { select: { studentAccountId: true } },
        },
      });

      const byPupil = new Map<string, string>();

      for (const leave of leaves) {
        // The child's own account wins when both are present: a parent's application is *about*
        // the pupil, and the applicant is the parent.
        const pupil = leave.child?.studentAccountId ?? leave.applicantAccountId;
        if (pupil) byPupil.set(pupil, leave.id);
      }

      return byPupil;
    },

    findRegister: async (classId, onDate) => {
      const rows = await db.attendanceEntry.findMany({
        where: { classId, onDate },
        select: {
          studentAccountId: true,
          state: true,
          leaveApplicationId: true,
          student: { select: { userProfile: { select: { fullName: true } } } },
        },
      });

      return rows.map((row) => ({
        studentAccountId: row.studentAccountId,
        studentName: row.student?.userProfile?.fullName ?? '',
        state: row.state,
        fromLeave: row.leaveApplicationId !== null,
      }));
    },

    registerTakenAt: async (classId, onDate) => {
      const first = await db.attendanceEntry.findFirst({
        where: { classId, onDate },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      return first?.createdAt ?? null;
    },

    takeRegister: async ({ classId, onDate, takenByAccountId, entries, previous }) => {
      await db.$transaction(async (tx) => {
        for (const entry of entries) {
          await tx.attendanceEntry.upsert({
            where: {
              classId_studentAccountId_onDate: {
                classId,
                studentAccountId: entry.studentAccountId,
                onDate,
              },
            },
            update: {
              state: entry.state,
              leaveApplicationId: entry.leaveApplicationId ?? null,
              takenByAccountId,
            },
            create: {
              classId,
              studentAccountId: entry.studentAccountId,
              onDate,
              state: entry.state,
              leaveApplicationId: entry.leaveApplicationId ?? null,
              takenByAccountId,
            },
          });

          // Only changes are audited, and only changes to something that already existed. A
          // register taken for the first time is not an amendment (FR-ATT-004), and an audit row
          // per pupil per day would bury the amendments that matter in a pile of them.
          const before = previous.get(entry.studentAccountId);
          if (before !== undefined && before !== entry.state) {
            await tx.auditLog.create({
              data: {
                actorAccountId: takenByAccountId,
                action: 'attendance.amended',
                entity: 'class',
                entityId: classId,
                metadata: {
                  studentAccountId: entry.studentAccountId,
                  onDate: onDate.toISOString().slice(0, 10),
                  previousState: before,
                  newState: entry.state,
                },
              },
            });
          }
        }
      });
    },

    listForPupil: async (studentAccountId, classId) => {
      const rows = await db.attendanceEntry.findMany({
        where: { studentAccountId, classId },
        select: { onDate: true, state: true, leaveApplicationId: true },
        orderBy: { onDate: 'desc' },
        take: 200,
      });

      return rows.map((row) => ({
        onDate: row.onDate,
        state: row.state,
        fromLeave: row.leaveApplicationId !== null,
      }));
    },
  };
}
