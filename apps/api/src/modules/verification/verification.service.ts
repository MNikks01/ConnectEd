/**
 * Verification domain logic and authorization (`.docs/PRD/03-verification.md`).
 *
 * This is the spine of the product: until a membership is `VERIFIED`, the server refuses every
 * academic read and write. Three rules do most of the work here.
 *
 * 1. **Only the school decides.** Not the principal, not a teacher — `assertIsSchool` on every
 *    decision path. FR-VER-005.
 * 2. **No self-approval.** A school account cannot submit a request at all, so the "school
 *    approving itself" case cannot arise. Enforced at submission, not only at decision.
 * 3. **Everything named in a request must belong to the school being asked.** A class or subject
 *    id from a *different* school would otherwise grant a membership scoped to a class the school
 *    does not own.
 */
import { classDisplayName } from '@connected/types';

import { assertIsSchool } from '../../shared/authz/index.js';
import { toPage } from '../../shared/http/pagination.js';

import type { Page, PageRequest } from '../../shared/http/pagination.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/index.js';

import type { VerificationRepository, VerificationRequestRow } from './verification.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { EventPublisher } from '../../shared/events/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type {
  MyMembershipResponse,
  MyTeachingSubjectResponse,
  SchoolMemberResponse,
  SubmitVerificationInput,
  VerificationDecisionInput,
  VerificationRequestResponse,
} from '@connected/types';
import type {
  ClassLevel,
  Medium,
  Section,
  UserRole,
  VerificationStatus,
} from '../../generated/prisma/client.js';

export interface VerificationService {
  submit: (actor: Actor, input: SubmitVerificationInput) => Promise<VerificationRequestResponse>;
  listForSchool: (
    actor: Actor,
    schoolId: string,
    status: VerificationStatus | undefined,
    page: PageRequest,
  ) => Promise<Page<VerificationRequestResponse>>;
  listMine: (actor: Actor, page: PageRequest) => Promise<Page<VerificationRequestResponse>>;
  decide: (
    actor: Actor,
    requestId: string,
    input: VerificationDecisionInput,
  ) => Promise<VerificationRequestResponse>;
  revokeMember: (actor: Actor, schoolId: string, accountId: string) => Promise<void>;
  listMembers: (actor: Actor, schoolId: string) => Promise<SchoolMemberResponse[]>;
  /**
   * Cross-module query, so it takes no actor: the caller has already authorized the operation this
   * answers a question for. Exposed on the public service because `membership` belongs to this
   * module — other modules must not read it directly (`.docs/Architecture/01-modules.md` rule 1).
   */
  isVerifiedMember: (input: {
    accountId: string;
    schoolId: string;
    role: UserRole;
  }) => Promise<boolean>;
  /** Recipients for a class-scoped notification. Cross-module query, so no actor. */
  listClassMemberAccountIds: (classId: string) => Promise<string[]>;
  listSchoolMemberAccountIds: (schoolId: string) => Promise<string[]>;
  listMyMemberships: (actor: Actor) => Promise<MyMembershipResponse[]>;
  listMyTeachingSubjects: (actor: Actor) => Promise<MyTeachingSubjectResponse[]>;
}

/** The slice of billing this module needs: may this school take on one more member? */
export interface EntitlementGuard {
  assertWithinLimit: (schoolId: string, limit: 'classes' | 'members') => Promise<void>;
}

export interface VerificationServiceDeps {
  repository: VerificationRepository;
  logger: Logger;
  /** Side effects travel as domain events, so this module never calls notifications directly. */
  events: EventPublisher;
  entitlements: EntitlementGuard;
}

export function createVerificationService({
  repository,
  logger,
  events,
  entitlements,
}: VerificationServiceDeps): VerificationService {
  return {
    submit: async (actor, input) => {
      // A school is the institution, not a member of one. Blocking here is what makes
      // self-approval structurally impossible rather than a check someone must remember.
      if (actor.accountType === 'SCHOOL') {
        throw new ForbiddenError('An institution account cannot request membership.');
      }

      const classId = 'classId' in input ? input.classId : undefined;

      if (classId && !(await repository.classBelongsToSchool(classId, input.schoolId))) {
        // Covers both "no such class" and "belongs to another school" — the requester learns
        // nothing either way.
        throw new NotFoundError('That class is not available at this school.');
      }

      const existing = await repository.findOpenRequest({
        requesterAccountId: actor.accountId,
        schoolId: input.schoolId,
        role: input.role,
        classId: classId ?? null,
      });

      if (existing) {
        // A rejected request may be re-submitted; a pending or already-verified one may not.
        throw new ConflictError('You already have a request for this role at this school.');
      }

      let childId: string | undefined;
      let subjectIds: string[] = [];

      if (input.role === 'PARENT') {
        const child = await repository.createChild({
          parentAccountId: actor.accountId,
          fullName: input.childFullName,
          schoolId: input.schoolId,
          classId: input.classId,
        });
        childId = child.id;
      }

      if (input.role === 'TEACHER') {
        if (!(await repository.subjectsBelongToSchool(input.subjectIds, input.schoolId))) {
          throw new NotFoundError('One or more subjects are not available at this school.');
        }
        subjectIds = [...new Set(input.subjectIds)];
      }

      const created = await repository.createRequest({
        requesterAccountId: actor.accountId,
        schoolId: input.schoolId,
        role: input.role,
        classId,
        childId,
        ...(subjectIds.length > 0 ? { payload: { subjectIds } } : {}),
      });

      logger.info(
        { accountId: actor.accountId, schoolId: input.schoolId, role: input.role },
        'Verification requested',
      );

      // Published after the write commits: a notification about something that did not happen is
      // worse than a missing one.
      await events.publish({
        type: 'verification.submitted',
        requestId: created.id,
        requesterAccountId: actor.accountId,
        schoolId: input.schoolId,
        role: input.role,
      });

      return toResponse(created);
    },

    listForSchool: async (actor, schoolId, status, page) => {
      // The review queue is the school's alone — it lists who is asking to join.
      assertIsSchool(actor, schoolId);

      const rows = await repository.listForSchool(schoolId, status, page);
      const paged = toPage(rows, page.limit);

      return { data: paged.data.map(toResponse), nextCursor: paged.nextCursor };
    },

    listMine: async (actor, page) => {
      const rows = await repository.listForRequester(actor.accountId, page);
      const paged = toPage(rows, page.limit);

      return { data: paged.data.map(toResponse), nextCursor: paged.nextCursor };
    },

    decide: async (actor, requestId, input) => {
      const request = await repository.findById(requestId);
      if (!request) throw new NotFoundError();

      // Throws 404 when the actor is another school, so request ids cannot be probed.
      assertIsSchool(actor, request.schoolId);

      if (request.status !== 'PENDING') {
        throw new ConflictError('That request has already been decided.');
      }

      if (input.decision === 'APPROVE') {
        // Approving is the write that turns a request into a verified member, so it is where the
        // members limit bites. Rejecting is never refused for want of room: a school that has run
        // out of seats must still be able to clear its queue.
        await entitlements.assertWithinLimit(request.schoolId, 'members');

        await repository.approve({
          requestId,
          actorAccountId: actor.accountId,
          requesterAccountId: request.requesterAccountId,
          schoolId: request.schoolId,
          role: request.role,
          classId: request.classId,
          childId: request.childId,
          subjectIds: subjectIdsFrom(request.payload),
          note: input.note,
        });
      } else {
        await repository.reject({ requestId, actorAccountId: actor.accountId, note: input.note });
      }

      logger.info(
        {
          requestId,
          schoolId: request.schoolId,
          decision: input.decision,
          requesterAccountId: request.requesterAccountId,
        },
        'Verification decided',
      );

      const updated = await repository.findById(requestId);
      if (!updated) throw new NotFoundError();

      await events.publish({
        type: 'verification.decided',
        requestId,
        requesterAccountId: request.requesterAccountId,
        schoolId: request.schoolId,
        role: request.role,
        status: updated.status,
      });

      return toResponse(updated);
    },

    /** FR-VER-008 — access is removed immediately, and an audit entry is written. */
    revokeMember: async (actor, schoolId, accountId) => {
      assertIsSchool(actor, schoolId);

      const revoked = await repository.revokeMembership({
        accountId,
        schoolId,
        actorAccountId: actor.accountId,
      });

      if (revoked === 0) {
        throw new NotFoundError('That account is not a verified member of this school.');
      }

      logger.info({ schoolId, accountId, revoked }, 'Membership revoked');

      await events.publish({ type: 'membership.revoked', accountId, schoolId });
    },

    /** The roster (FR-INST-005) — the school's own list of who it has verified. */
    listMembers: async (actor, schoolId) => {
      assertIsSchool(actor, schoolId);

      const rows = await repository.listMembers(schoolId);

      return rows.map((row) => ({
        accountId: row.accountId,
        fullName: row.fullName,
        handle: row.handle,
        role: row.role,
        status: row.status,
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
        since: row.since.toISOString(),
      }));
    },

    isVerifiedMember: (input) => repository.hasVerifiedMembership(input),

    listClassMemberAccountIds: (classId) => repository.listClassMemberAccountIds(classId),
    listSchoolMemberAccountIds: (schoolId) => repository.listSchoolMemberAccountIds(schoolId),

    /** Also scoped to the caller by construction, for the same reason. */
    listMyTeachingSubjects: async (actor) => {
      const rows = await repository.listAllocationsForAccount(actor.accountId);

      return rows.map((row) => ({
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        classId: row.classId,
        className: classDisplayName({
          medium: row.medium as Medium,
          level: row.level as ClassLevel,
          section: row.section as Section,
        }),
        schoolId: row.schoolId,
        schoolName: row.schoolName,
      }));
    },

    /** Scoped to the caller by construction — there is no path to another account's memberships. */
    listMyMemberships: async (actor) => {
      const rows = await repository.listMembershipsForAccount(actor.accountId);

      return rows.map((row) => ({
        schoolId: row.schoolId ?? '',
        schoolName: row.schoolName ?? null,
        role: row.role,
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
        since: row.since.toISOString(),
      }));
    },
  };
}

/** `payload` is jsonb, so it arrives as `unknown` and has to be narrowed rather than trusted. */
function subjectIdsFrom(payload: unknown): string[] {
  if (typeof payload !== 'object' || payload === null || !('subjectIds' in payload)) return [];

  const value: unknown = payload.subjectIds;
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === 'string');
}

function toResponse(row: VerificationRequestRow): VerificationRequestResponse {
  return {
    id: row.id,
    schoolId: row.schoolId,
    schoolName: row.schoolName,
    role: row.role,
    status: row.status,
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
    requesterAccountId: row.requesterAccountId,
    requesterName: row.requesterName,
    requesterHandle: row.requesterHandle,
    subjectIds: subjectIdsFrom(row.payload),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
