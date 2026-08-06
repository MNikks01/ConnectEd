/**
 * Academic content schemas and DTOs (`.docs/PRD/04-academics.md`).
 *
 * Homework, assignments, and projects are one entity with a `type` discriminator rather than three
 * tables: they differ only in the word shown to the user, and splitting them would triple every
 * query the class feed makes.
 */
import { z } from 'zod';

export const AcademicItemType = {
  HOMEWORK: 'HOMEWORK',
  ASSIGNMENT: 'ASSIGNMENT',
  PROJECT: 'PROJECT',
} as const;
export type AcademicItemType = (typeof AcademicItemType)[keyof typeof AcademicItemType];

export const publishAcademicItemSchema = z.object({
  type: z.enum(AcademicItemType),
  subjectId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  /** A key from `POST /media/academic-items`; the signed URL is issued on read. */
  imageKey: z.string().trim().max(300).nullish(),
  dueAt: z.iso.datetime().nullish(),
});

export const updateAcademicItemSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(10_000).optional(),
  imageKey: z.string().trim().max(300).nullish(),
  dueAt: z.iso.datetime().nullish(),
});

export type PublishAcademicItemInput = z.infer<typeof publishAcademicItemSchema>;
export type UpdateAcademicItemInput = z.infer<typeof updateAcademicItemSchema>;

export interface AcademicItemResponse {
  id: string;
  type: AcademicItemType;
  classId: string;
  subjectId: string;
  subjectName: string | null;
  title: string;
  body: string;
  /** Short-lived signed URL, issued only after the caller has been authorized. */
  imageUrl: string | null;
  dueAt: string | null;
  authorAccountId: string;
  authorName: string | null;
  createdAt: string;
  /** Whether *this* caller has read it. */
  read: boolean;
  /**
   * How many verified members have read it. Present only for the author and the school — a
   * student has no business knowing who else has opened their class's homework.
   */
  readCount?: number;
}

/**
 * The days a timetable can name.
 *
 * Seven rather than five: this product is India-first and a six-day week with a half-day Saturday
 * is ordinary there. A school that never teaches on Sunday simply never adds a Sunday period.
 */
export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/**
 * A time of day, `HH:MM`, 24-hour, zero-padded.
 *
 * Deliberately a string and not a `Date`. A period starts at nine in the morning wherever the
 * school is; attaching a date and a timezone to that invites the whole class of bugs where a
 * timetable shifts by an hour twice a year. Zero-padding also makes the strings sort and compare
 * as their own times, which is how overlap is checked.
 */
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 09:30.');

/**
 * One period. Either a subject or a label — a timetable has assemblies, breaks and games in it,
 * and forcing those into a subject row would put them in every subject-scoped read in the product.
 */
export const timetablePeriodSchema = z
  .object({
    day: z.enum(WEEKDAYS),
    startsAt: timeOfDay,
    endsAt: timeOfDay,
    /** Must be a subject of this class; the server checks, never the client. */
    subjectId: z.uuid().optional(),
    /** For a period that is not a subject: "Break", "Assembly", "Games". */
    label: z.string().trim().min(1).max(60).optional(),
  })
  .refine((period) => period.endsAt > period.startsAt, {
    message: 'A period must end after it starts.',
    path: ['endsAt'],
  })
  .refine((period) => Boolean(period.subjectId) !== Boolean(period.label), {
    message: 'A period is either a subject or a label, not both and not neither.',
    path: ['subjectId'],
  });

export type TimetablePeriodInput = z.infer<typeof timetablePeriodSchema>;

/**
 * A timetable version — an image or a structured week (FR-ACAD-020, FR-ACAD-021).
 *
 * One endpoint for both, because they are the same thing to everybody downstream: a version, with
 * a history, that every verified member of the class may read. A school that photographs the sheet
 * on the wall and a school that fills in the grid both end up with version *n+1*.
 */
export const uploadTimetableSchema = z
  .object({
    /** A key from `POST /media/timetables`; the signed URL is issued on read. */
    imageKey: z.string().trim().min(1).max(300).optional(),
    /**
     * A full week. Not a patch: publishing replaces, because a timetable read halfway through an
     * edit is a timetable somebody turns up to the wrong room for.
     */
    periods: z.array(timetablePeriodSchema).min(1).max(120).optional(),
  })
  .refine((input) => Boolean(input.imageKey) !== Boolean(input.periods), {
    message: 'Send either an image or a set of periods.',
    path: ['periods'],
  });

export type UploadTimetableInput = z.infer<typeof uploadTimetableSchema>;

export interface TimetablePeriodResponse {
  id: string;
  day: Weekday;
  startsAt: string;
  endsAt: string;
  subjectId: string | null;
  /** Resolved for display, so a client does not have to hold the subject list to render a grid. */
  subjectName: string | null;
  label: string | null;
}

export interface TimetableResponse {
  id: string;
  classId: string;
  /** Which of the two this version is. Stated rather than inferred from which field is null. */
  kind: 'IMAGE' | 'STRUCTURED';
  /** Short-lived signed URL, issued only after the caller has been authorized. */
  imageUrl: string | null;
  /**
   * Increments on every upload. Shown so a parent can tell "this is the third timetable this
   * term" from "nothing has changed since September".
   */
  version: number;
  /** Empty for an image version, and ordered by day then start time for a structured one. */
  periods: TimetablePeriodResponse[];
  createdAt: string;
}

/**
 * Syllabus coverage (FR-ACAD-030). One row per topic, so a teacher can record "Chapter 3 is half
 * done" rather than a single opaque percentage for the whole subject.
 */
export const upsertSyllabusTopicSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  percent: z.number().int().min(0).max(100),
});

export type UpsertSyllabusTopicInput = z.infer<typeof upsertSyllabusTopicSchema>;

export interface SyllabusTopicResponse {
  id: string;
  subjectId: string;
  topic: string;
  percent: number;
  updatedByAccountId: string | null;
  updatedByName: string | null;
  updatedAt: string;
}

export interface SyllabusCoverageResponse {
  subjectId: string;
  subjectName: string | null;
  /** Mean of the topic percentages, rounded — 0 when nothing has been recorded. */
  overallPercent: number;
  topics: SyllabusTopicResponse[];
}
