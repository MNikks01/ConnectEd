/**
 * Complaints and suggestions (FR-WF-010, 011, 012).
 *
 * Three distinct audiences, and the matrix separates them carefully:
 *
 * - **Submit** — parents, teachers, and the principal. Not students (hidden, carried from legacy),
 *   and not the school itself, which would be complaining to itself.
 * - **Review** — the school and its principal. Changing the status is a decision about the
 *   institution's own handling, so it belongs to the institution.
 * - **See the queue** — the above, plus teachers, who have view-only visibility (`👁`).
 *
 * A complaint names its author. That is deliberate and worth stating: this is not an anonymous
 * channel, and nothing here should be built as if it were.
 */
import {
  assertVerifiedMembership,
  assertVerifiedMemberOfSchool,
} from '../../shared/authz/index.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/index.js';

import type { FeedbackRepository, FeedbackRow } from './feedback.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { FeedbackStatus, UserRole } from '../../generated/prisma/client.js';
import type { FeedbackResponse, ReviewFeedbackInput, SubmitFeedbackInput } from '@connected/types';

export interface FeedbackService {
  submit: (actor: Actor, schoolId: string, input: SubmitFeedbackInput) => Promise<FeedbackResponse>;
  listForSchool: (
    actor: Actor,
    schoolId: string,
    status: FeedbackStatus | undefined,
  ) => Promise<{ data: FeedbackResponse[] }>;
  listMine: (actor: Actor) => Promise<{ data: FeedbackResponse[] }>;
  review: (
    actor: Actor,
    feedbackId: string,
    input: ReviewFeedbackInput,
  ) => Promise<FeedbackResponse>;
}

export interface FeedbackServiceDeps {
  repository: FeedbackRepository;
  db: Db;
  logger: Logger;
}

/** Who may raise a complaint at all (permission matrix, "Submit complaints/suggestions"). */
const MAY_SUBMIT: UserRole[] = ['PARENT', 'TEACHER', 'PRINCIPAL'];

export function createFeedbackService({
  repository,
  db,
  logger,
}: FeedbackServiceDeps): FeedbackService {
  function toResponse(row: FeedbackRow): FeedbackResponse {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      schoolId: row.schoolId,
      body: row.body,
      authorAccountId: row.authorAccountId,
      authorName: row.authorName,
      reviewedByAccountId: row.reviewedBy,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * A verified membership at this school in one of the roles that may complain.
   *
   * Checked against the membership rather than the token's role claim, and against *this* school:
   * being a teacher somewhere is not standing to complain here.
   */
  async function assertMaySubmit(actor: Actor, schoolId: string): Promise<void> {
    if (actor.accountType === 'SCHOOL') {
      throw new ForbiddenError('A school cannot raise a complaint with itself.');
    }

    const membership = await db.membership.findFirst({
      where: {
        accountId: actor.accountId,
        schoolId,
        status: 'VERIFIED',
        role: { in: [...MAY_SUBMIT] },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenError('Only verified parents, teachers, and principals may do this.');
    }
  }

  /** Reviewing — deciding what the school does about it — is the school's or its principal's. */
  async function assertMayReview(actor: Actor, schoolId: string): Promise<void> {
    if (actor.accountType === 'SCHOOL') {
      if (actor.accountId !== schoolId) throw new NotFoundError();
      return;
    }

    await assertVerifiedMembership(db, actor, schoolId, 'PRINCIPAL');
  }

  return {
    submit: async (actor, schoolId, input) => {
      await assertMaySubmit(actor, schoolId);

      const row = await repository.create({
        kind: input.kind,
        schoolId,
        authorAccountId: actor.accountId,
        body: input.body,
      });

      logger.info({ feedbackId: row.id, schoolId, kind: row.kind }, 'Feedback submitted');

      return toResponse(row);
    },

    /**
     * Teachers see the queue but cannot act on it (`👁`), so the read is wider than the write.
     * Parents are not on this list: a complaint one parent raised is not another's to read.
     */
    listForSchool: async (actor, schoolId, status) => {
      if (actor.accountType === 'SCHOOL') {
        if (actor.accountId !== schoolId) throw new NotFoundError();
      } else {
        await assertVerifiedMemberOfSchool(db, actor, schoolId);

        const staff = await db.membership.findFirst({
          where: {
            accountId: actor.accountId,
            schoolId,
            status: 'VERIFIED',
            role: { in: ['TEACHER', 'PRINCIPAL'] },
          },
          select: { id: true },
        });

        if (!staff) {
          throw new ForbiddenError('Only school staff can read the complaints queue.');
        }
      }

      return { data: (await repository.listForSchool(schoolId, status)).map(toResponse) };
    },

    /** Scoped to the caller by the query — how a parent follows what they raised. */
    listMine: async (actor) => ({
      data: (await repository.listForAuthor(actor.accountId)).map(toResponse),
    }),

    review: async (actor, feedbackId, input) => {
      const existing = await repository.findById(feedbackId);
      if (!existing) throw new NotFoundError();

      await assertMayReview(actor, existing.schoolId);

      // FR-WF-012: the person who raised it hears that something happened. The event commits
      // with the review (ADR-0019).
      const reviewed = await repository.review(
        {
          id: feedbackId,
          status: input.status,
          reviewedBy: actor.accountId,
        },
        (row) => ({
          type: 'feedback.reviewed',
          feedbackId,
          authorAccountId: row.authorAccountId,
          schoolId: row.schoolId,
          status: input.status,
        }),
      );

      await db.auditLog.create({
        data: {
          actorAccountId: actor.accountId,
          action: `feedback.${input.status.toLowerCase()}`,
          entity: 'feedback',
          entityId: feedbackId,
          metadata: { kind: reviewed.kind, authorAccountId: reviewed.authorAccountId },
        },
      });

      logger.info({ feedbackId, status: input.status }, 'Feedback reviewed');

      return toResponse(reviewed);
    },
  };
}
