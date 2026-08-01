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

export const uploadTimetableSchema = z.object({
  /** A key from `POST /media/timetables`; the signed URL is issued on read. */
  imageKey: z.string().trim().min(1).max(300),
});

export type UploadTimetableInput = z.infer<typeof uploadTimetableSchema>;

export interface TimetableResponse {
  id: string;
  classId: string;
  /** Short-lived signed URL, issued only after the caller has been authorized. */
  imageUrl: string | null;
  /**
   * Increments on every upload. Shown so a parent can tell "this is the third timetable this
   * term" from "nothing has changed since September".
   */
  version: number;
  createdAt: string;
}
