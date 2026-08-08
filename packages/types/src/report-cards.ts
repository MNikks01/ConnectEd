/**
 * Report cards (`.docs/PRD/13-report-cards.md`).
 *
 * **A card is a snapshot, not a view.** Everything below describes what was true at the moment it
 * was issued: a correction to a mark afterwards does not change a card, because a family keeps the
 * one they were given and a document that rewrites itself is not a document.
 */
import { z } from 'zod';

export const createTermSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-04-01.'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-07-20.'),
  })
  .refine((term) => term.startDate <= term.endDate, {
    message: 'A term cannot end before it starts.',
    path: ['endDate'],
  });

export type CreateTermInput = z.infer<typeof createTermSchema>;

export interface TermResponse {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  /** True once a card has been issued against it — after which its dates are frozen. */
  frozen: boolean;
}

/** Issuing is one action for a whole class (FR-GRADE-040). */
export const issueReportCardsSchema = z.object({
  termId: z.string().uuid(),
  /** Optional per-pupil comment, keyed by student account. The one typed field on a card. */
  comments: z.record(z.string().uuid(), z.string().trim().max(2000)).optional(),
});

export type IssueReportCardsInput = z.infer<typeof issueReportCardsSchema>;

/** One assessment as it appeared on the card. */
export interface CardAssessment {
  title: string;
  occurredOn: string;
  /** Null when the pupil was not marked — excluded from the totals, never counted as zero. */
  score: string | null;
  maxScore: string;
}

export interface CardSubject {
  subjectName: string;
  assessments: CardAssessment[];
  /** Totals over the assessments the pupil was actually marked for. */
  scored: string;
  available: string;
  /** Whole percent, or null when nothing counted — a pupil with no marks has no percentage. */
  percent: number | null;
}

/** Counts, deliberately: a percentage invites a threshold, and a threshold is a policy. */
export interface CardAttendance {
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface ReportCardSnapshot {
  subjects: CardSubject[];
  attendance: CardAttendance;
  /** Across every subject, on the same "only what was marked" basis. */
  overallPercent: number | null;
}

export interface ReportCardResponse {
  id: string;
  termId: string;
  termName: string;
  classId: string;
  studentAccountId: string;
  studentName: string;
  issuedAt: string;
  /** Set when this card replaced an earlier one, so it can say so on its face. */
  replacedIssuedAt: string | null;
  comment: string | null;
  snapshot: ReportCardSnapshot;
}
