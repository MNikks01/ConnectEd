/**
 * Verification request schemas and DTOs (`.docs/PRD/03-verification.md`).
 *
 * A member self-declares an academic role; the **school** approves it before any class academic
 * data is reachable. Until then the role confers nothing — the verified membership row is what
 * every academic check reads, not the role on the profile.
 *
 * The request shape differs per role, so this is a discriminated union rather than one schema with
 * four optional halves. That way "a student request carrying a childId" is a parse error instead of
 * something the service has to remember to reject.
 */
import { z } from 'zod';

import { UserRole, VerificationStatus } from './enums.js';

const uuid = z.uuid();

export const studentVerificationSchema = z.object({
  role: z.literal(UserRole.STUDENT),
  schoolId: uuid,
  classId: uuid,
});

export const parentVerificationSchema = z.object({
  role: z.literal(UserRole.PARENT),
  schoolId: uuid,
  classId: uuid,
  /** The child is created with the request; children do not have accounts. */
  childFullName: z.string().trim().min(1).max(120),
});

export const teacherVerificationSchema = z.object({
  role: z.literal(UserRole.TEACHER),
  schoolId: uuid,
  /** Subjects the teacher claims to teach; allocations are created on approval. */
  subjectIds: z.array(uuid).min(1).max(50),
});

export const principalVerificationSchema = z.object({
  role: z.literal(UserRole.PRINCIPAL),
  schoolId: uuid,
});

export const submitVerificationSchema = z.discriminatedUnion('role', [
  studentVerificationSchema,
  parentVerificationSchema,
  teacherVerificationSchema,
  principalVerificationSchema,
]);

export const verificationDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  /** Optional note recorded in the audit trail; never shown as the sole reason to the requester. */
  note: z.string().trim().max(500).optional(),
});

/**
 * Deciding several at once (FR-VER-009).
 *
 * Ids rather than "approve everything pending": a school looking at a filtered list and pressing a
 * button that means *all of them* would approve the ones that arrived while they were reading.
 * Naming each request is slower to build and impossible to get wrong.
 */
export const bulkVerificationDecisionSchema = z.object({
  requestIds: z.array(z.uuid()).min(1).max(100),
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(500).optional(),
});

export type BulkVerificationDecisionInput = z.infer<typeof bulkVerificationDecisionSchema>;

/**
 * What happened to each one.
 *
 * Per-request rather than a count, because the interesting outcome is partial: a school approving
 * forty people while its plan allows thirty needs to know *which ten* did not go through.
 */
export interface BulkVerificationResultResponse {
  decided: string[];
  failed: { requestId: string; reason: string }[];
}

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;
export type VerificationDecisionInput = z.infer<typeof verificationDecisionSchema>;

/** A verified member of a school — the roster row (FR-INST-005). */
export interface SchoolMemberResponse {
  accountId: string;
  fullName: string | null;
  handle: string | null;
  role: UserRole;
  status: VerificationStatus;
  classId: string | null;
  className: string | null;
  childId: string | null;
  childName: string | null;
  since: string;
}

/** One of the caller's own verified memberships — how a member finds their class. */
export interface MyMembershipResponse {
  schoolId: string;
  schoolName: string | null;
  role: UserRole;
  classId: string | null;
  className: string | null;
  childId: string | null;
  childName: string | null;
  since: string;
}

/**
 * A subject the caller teaches. Membership alone cannot answer this: a teacher's membership is
 * school-wide and carries no class, so without allocations a teacher has no way to find the
 * classes they teach.
 */
export interface MyTeachingSubjectResponse {
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  schoolId: string;
  schoolName: string | null;
}

export interface VerificationRequestResponse {
  id: string;
  schoolId: string;
  schoolName: string | null;
  role: UserRole;
  status: VerificationStatus;
  classId: string | null;
  className: string | null;
  childId: string | null;
  childName: string | null;
  requesterAccountId: string;
  requesterName: string | null;
  requesterHandle: string | null;
  subjectIds: string[];
  decidedAt: string | null;
  createdAt: string;
}
