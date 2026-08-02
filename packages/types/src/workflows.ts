/**
 * Leave applications (`.docs/PRD/05-workflows.md`, FR-WF-001..006).
 *
 * Two chains that share one table: a parent applies for a child and the **class teacher** of that
 * class decides; a teacher applies for themselves and the **principal** decides. `kind` is derived
 * from who is applying and to which endpoint — never sent by the client, because it selects the
 * approver.
 */
import { z } from 'zod';

export const LeaveStatus = {
  RECEIVED: 'RECEIVED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const;
export type LeaveStatus = (typeof LeaveStatus)[keyof typeof LeaveStatus];

export const LeaveKind = {
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
} as const;
export type LeaveKind = (typeof LeaveKind)[keyof typeof LeaveKind];

/**
 * A calendar date, `YYYY-MM-DD` — not a timestamp.
 *
 * Leave is counted in school days. An ISO datetime would carry an offset, and "2026-08-03T00:00Z"
 * is the 2nd of August in a school west of Greenwich: the same request would book a different day
 * depending on where the server stood.
 */
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date, YYYY-MM-DD.')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'That date does not exist.');

const leaveDates = {
  startDate: calendarDate,
  endDate: calendarDate,
  reason: z.string().trim().min(1).max(2000),
};

/** The range must not run backwards; equal dates are a single day off, which is normal. */
const endsAfterItStarts = <T extends { startDate: string; endDate: string }>(input: T): boolean =>
  input.endDate >= input.startDate;

export const applyForChildLeaveSchema = z
  .object(leaveDates)
  .refine(endsAfterItStarts, { message: 'Leave cannot end before it starts.', path: ['endDate'] });

export const applyForOwnLeaveSchema = z
  .object({ schoolId: z.uuid(), ...leaveDates })
  .refine(endsAfterItStarts, { message: 'Leave cannot end before it starts.', path: ['endDate'] });

export const leaveDecisionSchema = z.object({
  decision: z.enum(['ACCEPT', 'REJECT']),
  note: z.string().trim().max(1000).optional(),
});

export type ApplyForChildLeaveInput = z.infer<typeof applyForChildLeaveSchema>;
export type ApplyForOwnLeaveInput = z.infer<typeof applyForOwnLeaveSchema>;
export type LeaveDecisionInput = z.infer<typeof leaveDecisionSchema>;

export interface LeaveApplicationResponse {
  id: string;
  kind: LeaveKind;
  status: LeaveStatus;
  schoolId: string;
  classId: string | null;
  className: string | null;
  childId: string | null;
  childName: string | null;
  applicantAccountId: string;
  applicantName: string | null;
  /** `YYYY-MM-DD`, as submitted. */
  startDate: string;
  endDate: string;
  reason: string;
  decidedByAccountId: string | null;
  decidedAt: string | null;
  createdAt: string;
}
