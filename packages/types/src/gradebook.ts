/**
 * Gradebook — assessments and the marks pupils get for them (`.docs/PRD/11-gradebook.md`).
 *
 * The type that matters here is `MarkResponse`, and what matters about it is what it does **not**
 * carry: no class average, no highest mark, no position. A student may see their own mark and the
 * assessment's maximum, and nothing that tells a child how they compare to people who did not
 * consent to the comparison. Aggregates exist for teachers and are a different response.
 */
import { z } from 'zod';

export const ASSESSMENT_KINDS = ['TEST', 'EXAM', 'ASSIGNMENT', 'PRACTICAL'] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

/**
 * Scores are strings on the wire, not numbers.
 *
 * The column is `decimal(6,2)` because a mark of 17.5 is ordinary and binary floating point cannot
 * hold it exactly. Serialising as a number would hand JavaScript the same problem at the other end
 * — `JSON.parse` produces a double — so the string is the honest representation and the client
 * formats it.
 */
const score = z
  .string()
  .regex(/^\d{1,4}(\.\d{1,2})?$/, 'Use a number with up to two decimal places, like 17.5.');

export const createAssessmentSchema = z.object({
  subjectId: z.string().uuid(),
  kind: z.enum(ASSESSMENT_KINDS),
  title: z.string().trim().min(1).max(200),
  maxScore: score,
  /** The day it was sat, not the day it was entered. */
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-08-07.'),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

/**
 * Draft entry, for the whole class at once.
 *
 * A whole-class write rather than one request per pupil: marking is done in one sitting against a
 * pile of scripts, and thirty requests would leave a half-entered assessment behind whenever one
 * of them failed.
 */
export const enterMarksSchema = z.object({
  marks: z
    .array(
      z.object({
        studentAccountId: z.string().uuid(),
        /** `null` is "not marked" and is not a zero — see FR-GRADE-014. */
        score: score.nullable(),
        remark: z.string().trim().max(1000).optional(),
        /** Staff-only (FR-GRADE-015). Never returned to a pupil or parent. */
        staffNote: z.string().trim().max(1000).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export type EnterMarksInput = z.infer<typeof enterMarksSchema>;

/** Correcting one published mark. Separate from draft entry because it is audited. */
export const correctMarkSchema = z.object({
  score: score.nullable(),
  remark: z.string().trim().max(1000).optional(),
  staffNote: z.string().trim().max(1000).optional(),
});

export type CorrectMarkInput = z.infer<typeof correctMarkSchema>;

export interface AssessmentResponse {
  id: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  kind: AssessmentKind;
  title: string;
  maxScore: string;
  occurredOn: string;
  /** Null while the marks are still being entered. */
  publishedAt: string | null;
  createdAt: string;
}

/**
 * One pupil's result, **as the pupil and their parents see it**.
 *
 * Deliberately carries no comparison to anybody else's — and, since FR-GRADE-015, no staff note.
 * That omission is enforced by this type having nowhere to put one: a leak would have to be a new
 * field somebody added on purpose, not a `delete` somebody forgot.
 */
export interface MarkResponse {
  studentAccountId: string;
  studentName: string;
  score: string | null;
  remark: string | null;
}

/** The same mark as staff see it. The only shape that carries the staff note. */
export interface StaffMarkResponse extends MarkResponse {
  staffNote: string | null;
}

export interface AssessmentWithMarksResponse extends AssessmentResponse {
  marks: StaffMarkResponse[];
}

/** What a pupil or their parent reads: the assessment, and their own mark on it. */
export interface MyMarkResponse extends AssessmentResponse {
  mark: MarkResponse | null;
}

/**
 * Attendance — a register per class per day (`.docs/PRD/12-attendance.md`).
 *
 * Lives beside the gradebook because it is the same shape: a per-pupil fact, read by the pupil,
 * their parent through the school-confirmed link, and the staff who answer for the class.
 */
export const ATTENDANCE_STATES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
export type AttendanceState = (typeof ATTENDANCE_STATES)[number];

/** Taking a register: the whole class, in one action. Half a register is not a smaller register. */
export const takeRegisterSchema = z.object({
  onDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-08-07.'),
  entries: z
    .array(
      z.object({
        studentAccountId: z.string().uuid(),
        state: z.enum(ATTENDANCE_STATES),
      }),
    )
    .min(1)
    .max(200),
});

export type TakeRegisterInput = z.infer<typeof takeRegisterSchema>;

export interface AttendanceEntryResponse {
  studentAccountId: string;
  studentName: string;
  state: AttendanceState;
  /** Set when this came from an accepted leave, so a screen can say why rather than assert it. */
  fromLeave: boolean;
}

export interface RegisterResponse {
  classId: string;
  onDate: string;
  /** Null when nobody has taken it yet — an untaken register is not an empty one. */
  takenAt: string | null;
  entries: AttendanceEntryResponse[];
}

/** What a pupil or parent reads: their own days, newest first. */
export interface MyAttendanceResponse {
  onDate: string;
  state: AttendanceState;
  fromLeave: boolean;
}
