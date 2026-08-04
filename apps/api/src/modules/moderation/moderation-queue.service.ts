/**
 * Reviewing reports — S6-6 (ADR-0017).
 *
 * **The first capability in this product that acts on content the actor does not own.** Everything
 * before it — a post, a leave application, a class — is created, edited or deleted by somebody
 * acting on their own things. That makes three constraints non-negotiable rather than nice:
 *
 * 1. **Every decision is audited**, with the reviewer and their note. An unreviewable power over
 *    other people's words is not one this product should have.
 * 2. **The reporter is never disclosed.** The form promises it, and the promise has to be kept in
 *    the DTO rather than in the UI that happens to render it today.
 * 3. **`ACTIONED` means the content went.** A queue where "actioned" is a label somebody applies
 *    without anything happening teaches its reviewers that the button is decorative.
 */
import { ConflictError, NotFoundError, ValidationFailedError } from '../../shared/errors/index.js';
import { assertPlatformAdmin } from '../../shared/authz/index.js';

import type { ModerationQueueRepository, QueuedReportRow } from './moderation-queue.repository.js';
import type { Actor } from '../../shared/authz/index.js';
import type { Db } from '../../shared/db/index.js';
import type { ModerationDecisionInput, QueuedReportResponse } from '@connected/types';
import type { ReportStatus } from '../../generated/prisma/client.js';

export interface ModerationQueueService {
  list: (actor: Actor, status: ReportStatus | undefined) => Promise<QueuedReportResponse[]>;
  get: (actor: Actor, reportId: string) => Promise<QueuedReportResponse>;
  decide: (
    actor: Actor,
    reportId: string,
    input: ModerationDecisionInput,
  ) => Promise<QueuedReportResponse>;
}

export interface ModerationQueueServiceDeps {
  db: Db;
  repository: ModerationQueueRepository;
}

/** Content a reviewer can actually remove. An account or a private message needs more than this. */
const REMOVABLE = new Set(['POST', 'COMMENT']);

export function createModerationQueueService({
  db,
  repository,
}: ModerationQueueServiceDeps): ModerationQueueService {
  async function present(row: QueuedReportRow): Promise<QueuedReportResponse> {
    const subject = await repository.resolveSubject(row.subjectType, row.subjectId);

    return {
      id: row.id,
      status: row.status,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reportCount: row.reportCount,
      subject: {
        type: row.subjectType,
        id: row.subjectId,
        // A subject that no longer resolves is reported as gone rather than omitted: a report
        // about something already deleted is exactly the case moderation most needs to see.
        excerpt: subject?.excerpt ?? null,
        authorAccountId: subject?.authorAccountId ?? null,
        authorDisplayName: subject?.authorDisplayName ?? null,
        removed: subject?.removed ?? true,
      },
    };
  }

  async function load(actor: Actor, reportId: string): Promise<QueuedReportRow> {
    await assertPlatformAdmin(db, actor);

    const row = await repository.findById(reportId);
    if (!row) throw new NotFoundError();

    return row;
  }

  return {
    list: async (actor, status) => {
      await assertPlatformAdmin(db, actor);

      const rows = await repository.list(status);
      return Promise.all(rows.map((row) => present(row)));
    },

    get: async (actor, reportId) => present(await load(actor, reportId)),

    decide: async (actor, reportId, input) => {
      const row = await load(actor, reportId);

      // A decided report can be revisited — a dismissal that turns out to be wrong must be
      // fixable — but re-applying the same verdict is a double click, not a decision.
      if (row.status === input.decision) {
        throw new ConflictError('That report already has this decision.');
      }

      if (input.decision === 'ACTIONED') {
        if (!REMOVABLE.has(row.subjectType)) {
          // Rather than record a removal that did not happen. Acting on an account or a private
          // message needs suspension and a conversation, neither of which exists yet — and a
          // reviewer must not be able to believe they have dealt with something they have not.
          throw new ValidationFailedError(
            [
              {
                field: 'decision',
                issue: `${row.subjectType.toLowerCase()} reports cannot be actioned here yet`,
              },
            ],
            'Only posts and comments can be removed from the queue.',
          );
        }

        // Removal first: if it fails, nothing is recorded, and the report stays open for somebody
        // to try again. A report marked actioned over content still visible is the worst outcome.
        await repository.removeSubject(row.subjectType, row.subjectId);
      }

      await repository.decide({
        reportId,
        reviewerAccountId: actor.accountId,
        status: input.decision,
        note: input.note,
      });

      const updated = await repository.findById(reportId);
      if (!updated) throw new NotFoundError();

      return present(updated);
    },
  };
}
