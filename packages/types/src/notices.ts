/**
 * Notices and events (`.docs/PRD/04-academics.md`, FR-ACAD-010..012).
 *
 * Two entities rather than one with a discriminator, unlike homework/assignment/project: an event
 * is ordered by *when it happens* and a notice by when it was written, so they share a shape but
 * never a query.
 */
import { z } from 'zod';

export const createNoticeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
});

export const updateNoticeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(10_000).optional(),
});

export const createEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  /** When the event happens — not when it was created. */
  eventAt: z.iso.datetime(),
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(10_000).optional(),
  eventAt: z.iso.datetime().optional(),
});

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export interface NoticeResponse {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  authorAccountId: string;
  authorName: string | null;
  createdAt: string;
  /** Whether *this* caller has read it (FR-ACAD-010 is read-tracked). */
  read: boolean;
  /** How many verified members have read it. Present only for the author and the school. */
  readCount?: number;
}

export interface EventResponse {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  eventAt: string;
  createdAt: string;
}
