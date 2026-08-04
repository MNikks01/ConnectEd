/**
 * Leave persistence. **The only file in this module that touches Prisma.**
 */
import { BOUNDED_LIST_CAP } from '../../shared/http/pagination.js';

import type { Db } from '../../shared/db/index.js';
import type { LeaveKind, LeaveStatus } from '../../generated/prisma/client.js';

export interface LeaveRow {
  id: string;
  kind: LeaveKind;
  status: LeaveStatus;
  schoolId: string;
  classId: string | null;
  className: { medium: string; level: string; section: string } | null;
  childId: string | null;
  childName: string | null;
  applicantAccountId: string;
  applicantName: string | null;
  startDate: Date;
  endDate: Date;
  reason: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export interface LeaveRepository {
  create: (input: {
    kind: LeaveKind;
    schoolId: string;
    classId: string | null;
    childId: string | null;
    applicantAccountId: string;
    startDate: Date;
    endDate: Date;
    reason: string;
  }) => Promise<LeaveRow>;
  findById: (id: string) => Promise<LeaveRow | null>;
  listForClass: (classId: string, status: LeaveStatus | undefined) => Promise<LeaveRow[]>;
  listTeacherLeaveForSchool: (
    schoolId: string,
    status: LeaveStatus | undefined,
  ) => Promise<LeaveRow[]>;
  listForApplicant: (accountId: string) => Promise<LeaveRow[]>;
  /**
   * Records the decision and the decider, refusing to move an application that has already been
   * decided — the `status: 'RECEIVED'` in the filter is the guard, so two approvers racing produce
   * one decision and one miss rather than a silent overwrite.
   */
  decide: (input: {
    id: string;
    status: LeaveStatus;
    decidedBy: string;
  }) => Promise<LeaveRow | null>;
}

const SELECT = {
  id: true,
  kind: true,
  status: true,
  schoolId: true,
  classId: true,
  childId: true,
  applicantAccountId: true,
  startDate: true,
  endDate: true,
  reason: true,
  decidedBy: true,
  decidedAt: true,
  createdAt: true,
  class: { select: { medium: true, level: true, section: true } },
  child: { select: { fullName: true } },
  applicant: { select: { userProfile: { select: { fullName: true } } } },
} as const;

interface RawLeave {
  id: string;
  kind: LeaveKind;
  status: LeaveStatus;
  schoolId: string;
  classId: string | null;
  childId: string | null;
  applicantAccountId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  class: { medium: string; level: string; section: string } | null;
  child: { fullName: string } | null;
  applicant: { userProfile: { fullName: string } | null } | null;
}

function toRow(raw: RawLeave): LeaveRow {
  return {
    id: raw.id,
    kind: raw.kind,
    status: raw.status,
    schoolId: raw.schoolId,
    classId: raw.classId,
    className: raw.class,
    childId: raw.childId,
    childName: raw.child?.fullName ?? null,
    applicantAccountId: raw.applicantAccountId,
    applicantName: raw.applicant?.userProfile?.fullName ?? null,
    startDate: raw.startDate,
    endDate: raw.endDate,
    reason: raw.reason,
    decidedBy: raw.decidedBy,
    decidedAt: raw.decidedAt,
    createdAt: raw.createdAt,
  };
}

export function createLeaveRepository(db: Db): LeaveRepository {
  return {
    create: async (input) =>
      toRow(await db.leaveApplication.create({ data: input, select: SELECT })),

    findById: async (id) => {
      const row = await db.leaveApplication.findUnique({ where: { id }, select: SELECT });
      return row ? toRow(row) : null;
    },

    listForClass: async (classId, status) => {
      const rows = await db.leaveApplication.findMany({
        where: { classId, kind: 'STUDENT', ...(status ? { status } : {}) },
        select: SELECT,
        // Oldest first: a queue is worked from the front, unlike a feed.
        orderBy: { createdAt: 'asc' },
        take: BOUNDED_LIST_CAP,
      });
      return rows.map(toRow);
    },

    listTeacherLeaveForSchool: async (schoolId, status) => {
      const rows = await db.leaveApplication.findMany({
        where: { schoolId, kind: 'TEACHER', ...(status ? { status } : {}) },
        select: SELECT,
        orderBy: { createdAt: 'asc' },
        take: BOUNDED_LIST_CAP,
      });
      return rows.map(toRow);
    },

    listForApplicant: async (accountId) => {
      const rows = await db.leaveApplication.findMany({
        where: { applicantAccountId: accountId },
        select: SELECT,
        orderBy: { createdAt: 'desc' },
        take: BOUNDED_LIST_CAP,
      });
      return rows.map(toRow);
    },

    decide: async ({ id, status, decidedBy }) => {
      const { count } = await db.leaveApplication.updateMany({
        where: { id, status: 'RECEIVED' },
        data: { status, decidedBy, decidedAt: new Date() },
      });

      if (count === 0) return null;

      const row = await db.leaveApplication.findUnique({ where: { id }, select: SELECT });
      return row ? toRow(row) : null;
    },
  };
}
