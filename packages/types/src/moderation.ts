/**
 * The moderation queue (`.docs/PRD/06-social.md`, ADR-0017).
 *
 * **The reporter is not in any of these shapes.** The reporting form promises that nobody at the
 * reporter's school is told, and a DTO that carries the reporter's name is one careless render
 * away from breaking that promise in the console. A reviewer needs to know *what* was reported and
 * *how many people* said so; they do not need to know who, and the queue does not offer it.
 */
import { z } from 'zod';

export type ReportSubjectType = 'POST' | 'COMMENT' | 'MESSAGE' | 'ACCOUNT';
export type ModerationStatus = 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';

/** What was reported, as much of it as a reviewer needs to judge it. */
export interface ReportedSubject {
  type: ReportSubjectType;
  id: string;
  /** The content itself, or `null` when its author has since deleted it. */
  excerpt: string | null;
  /** Who wrote it — the subject of the report, who is not protected by the reporter's anonymity. */
  authorAccountId: string | null;
  authorDisplayName: string | null;
  /** Already gone, by its author's hand or a previous decision. */
  removed: boolean;
}

export interface QueuedReportResponse {
  id: string;
  status: ModerationStatus;
  reason: string;
  createdAt: string;
  reviewedAt: string | null;
  subject: ReportedSubject;
  /** How many separate people reported this same thing. Two is a different signal from one. */
  reportCount: number;
}

export const moderationDecisionSchema = z.object({
  /**
   * `ACTIONED` means the content was removed; `DISMISSED` means it was looked at and left.
   * `REVIEWED` is neither — it is "seen, needs a second opinion", so a queue can be triaged
   * without forcing a verdict nobody is ready to give.
   */
  decision: z.enum(['REVIEWED', 'ACTIONED', 'DISMISSED']),
  /** Recorded in the audit trail, never shown to the reporter or the subject. */
  note: z.string().trim().max(2000).optional(),
});

export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
