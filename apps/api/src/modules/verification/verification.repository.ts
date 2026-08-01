/**
 * Verification persistence. **The only file in this module that touches Prisma.**
 *
 * The approval path is one transaction on purpose: it flips the request, creates or updates the
 * membership, provisions a teacher profile and subject allocations, and writes the audit entry.
 * Partially applied, it would leave someone holding academic access with no request explaining
 * why — or a request marked approved that grants nothing.
 */
import { membershipScopeKey } from '../../shared/db/membership-scope.js';
import {
  BOUNDED_LIST_CAP,
  CURSOR_ORDER,
  cursorFilter,
  takeFor,
} from '../../shared/http/pagination.js';

import type { PageRequest } from '../../shared/http/pagination.js';

import type { Db } from '../../shared/db/index.js';
import type { UserRole, VerificationStatus } from '../../generated/prisma/client.js';

export interface VerificationRequestRow {
  id: string;
  requesterAccountId: string;
  schoolId: string;
  role: UserRole;
  classId: string | null;
  childId: string | null;
  status: VerificationStatus;
  decidedAt: Date | null;
  createdAt: Date;
  payload: unknown;
  schoolName: string | null;
  requesterName: string | null;
  requesterHandle: string | null;
  childName: string | null;
  className: { medium: string; level: string; section: string } | null;
}

export interface CreateRequestInput {
  requesterAccountId: string;
  schoolId: string;
  role: UserRole;
  classId?: string | undefined;
  childId?: string | undefined;
  payload?: { subjectIds?: string[] } | undefined;
}

export interface ApproveInput {
  requestId: string;
  actorAccountId: string;
  requesterAccountId: string;
  schoolId: string;
  role: UserRole;
  classId: string | null;
  childId: string | null;
  subjectIds: string[];
  note?: string | undefined;
}

export interface VerificationRepository {
  findById: (id: string) => Promise<VerificationRequestRow | null>;
  findOpenRequest: (input: {
    requesterAccountId: string;
    schoolId: string;
    role: UserRole;
    classId: string | null;
  }) => Promise<{ id: string } | null>;
  createRequest: (input: CreateRequestInput) => Promise<VerificationRequestRow>;
  createChild: (input: {
    parentAccountId: string;
    fullName: string;
    schoolId: string;
    classId: string;
  }) => Promise<{ id: string }>;
  listForSchool: (
    schoolId: string,
    status: VerificationStatus | undefined,
    page: PageRequest,
  ) => Promise<VerificationRequestRow[]>;
  listForRequester: (accountId: string, page: PageRequest) => Promise<VerificationRequestRow[]>;
  approve: (input: ApproveInput) => Promise<void>;
  reject: (input: {
    requestId: string;
    actorAccountId: string;
    note?: string | undefined;
  }) => Promise<void>;
  revokeMembership: (input: {
    accountId: string;
    schoolId: string;
    actorAccountId: string;
  }) => Promise<number>;
  classBelongsToSchool: (classId: string, schoolId: string) => Promise<boolean>;
  subjectsBelongToSchool: (subjectIds: string[], schoolId: string) => Promise<boolean>;
  listMembers: (schoolId: string) => Promise<MemberRow[]>;
  hasVerifiedMembership: (input: {
    accountId: string;
    schoolId: string;
    role: UserRole;
  }) => Promise<boolean>;
  listClassMemberAccountIds: (classId: string) => Promise<string[]>;
  listMembershipsForAccount: (accountId: string) => Promise<MemberRow[]>;
}

export interface MemberRow {
  accountId: string;
  fullName: string | null;
  handle: string | null;
  role: UserRole;
  status: VerificationStatus;
  classId: string | null;
  className: { medium: string; level: string; section: string } | null;
  childId: string | null;
  childName: string | null;
  since: Date;
  schoolId?: string;
  schoolName?: string | null;
}

const REQUEST_SELECT = {
  id: true,
  requesterAccountId: true,
  schoolId: true,
  role: true,
  classId: true,
  childId: true,
  status: true,
  decidedAt: true,
  createdAt: true,
  payload: true,
  school: { select: { name: true } },
  requester: { select: { userProfile: { select: { fullName: true, handle: true } } } },
  child: { select: { fullName: true } },
  class: { select: { medium: true, level: true, section: true } },
} as const;

interface RawRequest {
  id: string;
  requesterAccountId: string;
  schoolId: string;
  role: UserRole;
  classId: string | null;
  childId: string | null;
  status: VerificationStatus;
  decidedAt: Date | null;
  createdAt: Date;
  payload: unknown;
  school: { name: string } | null;
  requester: { userProfile: { fullName: string; handle: string } | null } | null;
  child: { fullName: string } | null;
  class: { medium: string; level: string; section: string } | null;
}

function toRow(raw: RawRequest): VerificationRequestRow {
  return {
    id: raw.id,
    requesterAccountId: raw.requesterAccountId,
    schoolId: raw.schoolId,
    role: raw.role,
    classId: raw.classId,
    childId: raw.childId,
    status: raw.status,
    decidedAt: raw.decidedAt,
    createdAt: raw.createdAt,
    payload: raw.payload,
    schoolName: raw.school?.name ?? null,
    requesterName: raw.requester?.userProfile?.fullName ?? null,
    requesterHandle: raw.requester?.userProfile?.handle ?? null,
    childName: raw.child?.fullName ?? null,
    className: raw.class,
  };
}

export function createVerificationRepository(db: Db): VerificationRepository {
  return {
    findById: async (id) => {
      const row = await db.verificationRequest.findUnique({
        where: { id },
        select: REQUEST_SELECT,
      });
      return row ? toRow(row) : null;
    },

    /** A request already awaiting or granted for the same scope; used to block duplicates. */
    findOpenRequest: ({ requesterAccountId, schoolId, role, classId }) =>
      db.verificationRequest.findFirst({
        where: {
          requesterAccountId,
          schoolId,
          role,
          ...(classId ? { classId } : {}),
          status: { in: ['PENDING', 'VERIFIED'] },
        },
        select: { id: true },
      }),

    createRequest: async (input) => {
      const row = await db.verificationRequest.create({
        data: {
          requesterAccountId: input.requesterAccountId,
          schoolId: input.schoolId,
          role: input.role,
          ...(input.classId ? { classId: input.classId } : {}),
          ...(input.childId ? { childId: input.childId } : {}),
          ...(input.payload ? { payload: input.payload } : {}),
          status: 'PENDING',
        },
        select: REQUEST_SELECT,
      });
      return toRow(row);
    },

    createChild: ({ parentAccountId, fullName, schoolId, classId }) =>
      db.child.create({
        data: { parentAccountId, fullName, schoolId, classId },
        select: { id: true },
      }),

    listForSchool: async (schoolId, status, page) => {
      const rows = await db.verificationRequest.findMany({
        where: { schoolId, ...(status ? { status } : {}), ...cursorFilter(page.after) },
        select: REQUEST_SELECT,
        // Newest first, unlike the previous oldest-first order: a queue that grows is read from
        // the top, and cursor pagination needs one consistent direction.
        orderBy: [...CURSOR_ORDER],
        take: takeFor(page.limit),
      });
      return rows.map((row) => toRow(row));
    },

    listForRequester: async (accountId, page) => {
      const rows = await db.verificationRequest.findMany({
        where: { requesterAccountId: accountId, ...cursorFilter(page.after) },
        select: REQUEST_SELECT,
        orderBy: [...CURSOR_ORDER],
        take: takeFor(page.limit),
      });
      return rows.map((row) => toRow(row));
    },

    approve: async (input) => {
      const scopeKey = membershipScopeKey(input.classId, input.childId);
      const now = new Date();

      await db.$transaction(async (tx) => {
        await tx.verificationRequest.update({
          where: { id: input.requestId },
          data: { status: 'VERIFIED', decidedBy: input.actorAccountId, decidedAt: now },
        });

        await tx.membership.upsert({
          where: {
            accountId_schoolId_role_scopeKey: {
              accountId: input.requesterAccountId,
              schoolId: input.schoolId,
              role: input.role,
              scopeKey,
            },
          },
          // Re-approval of a previously revoked scope reinstates it rather than duplicating.
          update: { status: 'VERIFIED' },
          create: {
            accountId: input.requesterAccountId,
            schoolId: input.schoolId,
            role: input.role,
            classId: input.classId,
            childId: input.childId,
            scopeKey,
            status: 'VERIFIED',
          },
        });

        if (input.role === 'TEACHER') {
          const teacher = await tx.teacherProfile.upsert({
            where: {
              accountId_schoolId: {
                accountId: input.requesterAccountId,
                schoolId: input.schoolId,
              },
            },
            update: {},
            create: { accountId: input.requesterAccountId, schoolId: input.schoolId },
            select: { id: true },
          });

          for (const subjectId of input.subjectIds) {
            await tx.subjectAllocation.upsert({
              where: { teacherId_subjectId: { teacherId: teacher.id, subjectId } },
              update: {},
              create: { teacherId: teacher.id, subjectId },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            actorAccountId: input.actorAccountId,
            action: 'verification.approved',
            entity: 'verification_request',
            entityId: input.requestId,
            metadata: {
              requesterAccountId: input.requesterAccountId,
              schoolId: input.schoolId,
              role: input.role,
              classId: input.classId,
              childId: input.childId,
              subjectIds: input.subjectIds,
              ...(input.note ? { note: input.note } : {}),
            },
          },
        });
      });
    },

    reject: async ({ requestId, actorAccountId, note }) => {
      await db.$transaction([
        db.verificationRequest.update({
          where: { id: requestId },
          data: { status: 'REJECTED', decidedBy: actorAccountId, decidedAt: new Date() },
        }),
        db.auditLog.create({
          data: {
            actorAccountId,
            action: 'verification.rejected',
            entity: 'verification_request',
            entityId: requestId,
            metadata: note ? { note } : {},
          },
        }),
      ]);
    },

    /** Returns how many membership rows were revoked, so the service can 404 on none. */
    revokeMembership: async ({ accountId, schoolId, actorAccountId }) => {
      const result = await db.$transaction(async (tx) => {
        const updated = await tx.membership.updateMany({
          where: { accountId, schoolId, status: 'VERIFIED' },
          data: { status: 'REVOKED' },
        });

        if (updated.count > 0) {
          await tx.auditLog.create({
            data: {
              actorAccountId,
              action: 'membership.revoked',
              entity: 'account',
              entityId: accountId,
              metadata: { schoolId, revokedCount: updated.count },
            },
          });
        }

        return updated.count;
      });

      return result;
    },

    classBelongsToSchool: async (classId, schoolId) =>
      (await db.class.count({ where: { id: classId, schoolId, active: true } })) > 0,

    listMembers: async (schoolId) => {
      const rows = await db.membership.findMany({
        // Revoked and rejected scopes are history, not membership.
        where: { schoolId, status: 'VERIFIED' },
        select: {
          accountId: true,
          role: true,
          status: true,
          classId: true,
          childId: true,
          createdAt: true,
          account: { select: { userProfile: { select: { fullName: true, handle: true } } } },
          class: { select: { medium: true, level: true, section: true } },
          child: { select: { fullName: true } },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        take: BOUNDED_LIST_CAP,
      });

      return rows.map((row) => ({
        accountId: row.accountId,
        fullName: row.account.userProfile?.fullName ?? null,
        handle: row.account.userProfile?.handle ?? null,
        role: row.role,
        status: row.status,
        classId: row.classId,
        className: row.class,
        childId: row.childId,
        childName: row.child?.fullName ?? null,
        since: row.createdAt,
      }));
    },

    /**
     * Everyone a class notification should reach: members scoped to the class (students, parents
     * of a child in it) and the school-wide roles whose membership carries no class (teachers,
     * principal). The school account itself is excluded — it publishes, it does not need telling.
     */
    listClassMemberAccountIds: async (classId) => {
      const klass = await db.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });
      if (!klass) return [];

      const rows = await db.membership.findMany({
        where: {
          schoolId: klass.schoolId,
          status: 'VERIFIED',
          OR: [{ classId }, { classId: null }],
        },
        select: { accountId: true },
      });

      return [...new Set(rows.map((row) => row.accountId))];
    },

    /** The caller's own memberships — how a member discovers which class they are in. */
    listMembershipsForAccount: async (accountId) => {
      const rows = await db.membership.findMany({
        where: { accountId, status: 'VERIFIED' },
        select: {
          accountId: true,
          role: true,
          status: true,
          classId: true,
          childId: true,
          createdAt: true,
          account: { select: { userProfile: { select: { fullName: true, handle: true } } } },
          class: { select: { medium: true, level: true, section: true } },
          child: { select: { fullName: true } },
          school: { select: { accountId: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: BOUNDED_LIST_CAP,
      });

      return rows.map((row) => ({
        accountId: row.accountId,
        fullName: row.account.userProfile?.fullName ?? null,
        handle: row.account.userProfile?.handle ?? null,
        role: row.role,
        status: row.status,
        classId: row.classId,
        className: row.class,
        childId: row.childId,
        childName: row.child?.fullName ?? null,
        since: row.createdAt,
        schoolId: row.school.accountId,
        schoolName: row.school.name,
      }));
    },

    hasVerifiedMembership: async ({ accountId, schoolId, role }) =>
      (await db.membership.count({ where: { accountId, schoolId, role, status: 'VERIFIED' } })) > 0,

    subjectsBelongToSchool: async (subjectIds, schoolId) => {
      if (subjectIds.length === 0) return true;

      const count = await db.subject.count({
        where: { id: { in: subjectIds }, class: { schoolId } },
      });

      // Every id must resolve inside this school — a partial match means at least one was foreign.
      return count === new Set(subjectIds).size;
    },
  };
}
