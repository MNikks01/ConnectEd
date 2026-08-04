/**
 * Authorization helpers — the enforcement contract for
 * [the permission matrix](../../../../../.docs/PRD/09-permissions-matrix.md).
 *
 * Layering (`.docs/Security/02-authorization.md`): these are levels 2 and 3. Route guards
 * (`requireRole`, `requireAccountType`) are a cheap early reject on identity alone. Data-aware
 * policies (`assertVerifiedMemberOfClass`, …) are the authoritative check and must be called by
 * the service before touching scoped data — a guard passing is never sufficient.
 *
 * Everything here throws; nothing returns a boolean. A boolean invites `if (can(...)) {}` with a
 * forgotten `else`, and a forgotten `else` is an authorization bypass. A throw cannot be ignored.
 */
import { ForbiddenError, NotFoundError, VerificationRequiredError } from '../errors/index.js';
import { membershipScopeKey } from '../db/membership-scope.js';

import type { Actor } from './actor.js';
import type { Db } from '../db/index.js';
import type { AccountType, UserRole } from '../../generated/prisma/client.js';

export type { Actor } from './actor.js';

/** Identity-only guard. Cheap, and never sufficient on its own for scoped data. */
export function requireRole(actor: Actor, allowed: readonly UserRole[]): void {
  if (!actor.role || !allowed.includes(actor.role)) {
    throw new ForbiddenError('Your role does not permit this action.');
  }
}

export function requireAccountType(actor: Actor, allowed: AccountType): void {
  if (actor.accountType !== allowed) {
    throw new ForbiddenError('This action is not available for your account type.');
  }
}

/**
 * The school itself, acting on its own record. School accounts have no role, so role checks do
 * not apply to them — ownership is the whole test.
 */
export function assertIsSchool(actor: Actor, schoolId: string): void {
  requireAccountType(actor, 'SCHOOL');

  if (actor.accountId !== schoolId) {
    // A school asking about another school's data is out of scope, not merely forbidden — 404
    // avoids confirming that the other school exists (`.docs/API/01-conventions.md`).
    throw new NotFoundError();
  }
}

/**
 * Verified membership of a class: the check behind every academic read.
 *
 * Covers the student in the class, the parent of a child in it, and school-wide roles (teacher,
 * principal) whose membership carries no class. The school account itself always passes for its
 * own classes.
 */
export async function assertVerifiedMemberOfClass(
  db: Db,
  actor: Actor,
  classId: string,
): Promise<void> {
  const klass = await db.class.findUnique({
    where: { id: classId },
    select: { id: true, schoolId: true },
  });

  // Unknown class and out-of-scope class must be indistinguishable.
  if (!klass) throw new NotFoundError();

  if (actor.accountType === 'SCHOOL') {
    if (actor.accountId !== klass.schoolId) throw new NotFoundError();
    return;
  }

  const membership = await db.membership.findFirst({
    where: {
      accountId: actor.accountId,
      schoolId: klass.schoolId,
      status: 'VERIFIED',
      // Either scoped to this class, or a school-wide role (teacher/principal) with no class.
      OR: [{ classId }, { classId: null }],
    },
    select: { id: true, role: true },
  });

  if (!membership) {
    throw new VerificationRequiredError('You must be a verified member of this class.');
  }
}

/** A teacher may write only to a subject they are allocated to (`.docs/Database/03-rbac-data.md`). */
export async function assertTeacherAllocatedToSubject(
  db: Db,
  actor: Actor,
  subjectId: string,
): Promise<void> {
  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, class: { select: { schoolId: true } } },
  });

  if (!subject) throw new NotFoundError();

  // The school publishing to its own subject is allowed by the matrix.
  if (actor.accountType === 'SCHOOL') {
    if (actor.accountId !== subject.class.schoolId) throw new NotFoundError();
    return;
  }

  // Deliberately *not* `requireRole(actor, ['TEACHER'])`. The role claim in the access token is
  // the profile role, and registration creates every individual as `USER` (FR-AUTH-001) — a real
  // teacher never carries a TEACHER claim, so that guard rejected exactly the people it was meant
  // to admit. The permission matrix is explicit that "the verified `membership` row is what every
  // academic check reads", and the two DB-backed checks below are strictly stronger than the claim.
  const allocation = await db.subjectAllocation.findFirst({
    where: {
      subjectId,
      teacher: { accountId: actor.accountId, schoolId: subject.class.schoolId },
    },
    select: { id: true },
  });

  if (!allocation) {
    throw new ForbiddenError('You are not allocated to this subject.');
  }

  await assertVerifiedMembership(db, actor, subject.class.schoolId, 'TEACHER');
}

/** Leave approval for students/parents belongs to the class teacher of that class only. */
export async function assertClassTeacherOf(db: Db, actor: Actor, classId: string): Promise<void> {
  const classTeacher = await db.classTeacher.findUnique({
    where: { classId },
    select: { teacher: { select: { accountId: true, schoolId: true } } },
  });

  if (!classTeacher || classTeacher.teacher.accountId !== actor.accountId) {
    throw new ForbiddenError('Only the class teacher can perform this action.');
  }

  await assertVerifiedMembership(db, actor, classTeacher.teacher.schoolId, 'TEACHER');
}

/** Teacher-leave approval belongs to the principal of that school only. */
export async function assertPrincipalOfSchool(
  db: Db,
  actor: Actor,
  schoolId: string,
): Promise<void> {
  // Membership, not the token's role claim — see the note in `assertTeacherAllocatedToSubject`.
  await assertVerifiedMembership(db, actor, schoolId, 'PRINCIPAL');
}

/** A parent acts only within the scope of a child whose membership is verified. */
export async function assertParentOfVerifiedChild(
  db: Db,
  actor: Actor,
  childId: string,
): Promise<void> {
  const child = await db.child.findUnique({
    where: { id: childId },
    select: { id: true, parentAccountId: true, schoolId: true, classId: true },
  });

  if (!child) throw new NotFoundError();

  if (child.parentAccountId !== actor.accountId) {
    // Another parent's child is not theirs to see.
    throw new NotFoundError();
  }

  if (!child.schoolId) {
    throw new VerificationRequiredError('This child is not enrolled at a school yet.');
  }

  const membership = await db.membership.findUnique({
    where: {
      accountId_schoolId_role_scopeKey: {
        accountId: actor.accountId,
        schoolId: child.schoolId,
        role: 'PARENT',
        scopeKey: membershipScopeKey(child.classId, child.id),
      },
    },
    select: { status: true },
  });

  if (membership?.status !== 'VERIFIED') {
    throw new VerificationRequiredError('Your link to this child is not verified yet.');
  }
}

/**
 * School-wide reads: notices, events, and anything else addressed to the whole community.
 *
 * Any verified membership passes, whatever its role or class scope — a notice is for everyone at
 * the school. The school itself passes for its own record.
 */
export async function assertVerifiedMemberOfSchool(
  db: Db,
  actor: Actor,
  schoolId: string,
): Promise<void> {
  if (actor.accountType === 'SCHOOL') {
    // A school reading another school's notices is out of scope, not merely forbidden.
    if (actor.accountId !== schoolId) throw new NotFoundError();
    return;
  }

  const membership = await db.membership.findFirst({
    where: { accountId: actor.accountId, schoolId, status: 'VERIFIED' },
    select: { id: true },
  });

  if (!membership) {
    throw new VerificationRequiredError('You must be a verified member of this school.');
  }
}

/**
 * Publishing a notice: the school itself, or its verified principal (permission matrix, "Publish
 * notices"). A teacher may not — a notice speaks for the institution.
 */
export async function assertMayPublishNotice(
  db: Db,
  actor: Actor,
  schoolId: string,
): Promise<void> {
  if (actor.accountType === 'SCHOOL') {
    if (actor.accountId !== schoolId) throw new NotFoundError();
    return;
  }

  // Membership, not the token's role claim — see the note in `assertTeacherAllocatedToSubject`.
  await assertVerifiedMembership(db, actor, schoolId, 'PRINCIPAL');
}

/** Author-only edit/delete. */
export function assertOwnsResource(actor: Actor, ownerAccountId: string): void {
  if (actor.accountId !== ownerAccountId) {
    throw new ForbiddenError('You can only modify your own content.');
  }
}

/**
 * The caller holds this role, verified, at this school.
 *
 * Exported as well as used internally: teacher leave is applied for by a teacher of a *particular*
 * school, which is neither "any member" nor a class-scoped question.
 */
export async function assertVerifiedMembership(
  db: Db,
  actor: Actor,
  schoolId: string,
  role: UserRole,
): Promise<void> {
  const membership = await db.membership.findFirst({
    where: { accountId: actor.accountId, schoolId, role, status: 'VERIFIED' },
    select: { id: true },
  });

  if (!membership) {
    throw new VerificationRequiredError('Your membership at this school is not verified.');
  }
}
