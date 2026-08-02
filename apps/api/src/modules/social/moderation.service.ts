/**
 * Blocking and reporting (`PRD/06-social.md`, Moderation & safety).
 *
 * Blocking was built in S4-2 as a *filter* — every social read has honoured it since. This adds
 * the endpoints that create and remove one, which is the half a person can actually use.
 *
 * **Reporting has no reviewer.** The rows accumulate and nothing reads them, because who reviews a
 * report is an open product question: a school moderates its own community, but social spans
 * schools and this product has no platform-admin role. Recording them from the start means
 * whoever gets that job inherits the history instead of starting from nothing — and it means a
 * child can report something today rather than after the tooling exists.
 */
import { NotFoundError, ValidationFailedError } from '../../shared/errors/index.js';

import type { CardRow } from './graph.repository.js';
import type { ModerationRepository, ReportRow } from './moderation.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type {
  BlockListResponse,
  BlockResponse,
  CreateReportInput,
  ReportResponse,
} from '@connected/types';

export interface ModerationService {
  block: (actor: Actor, accountId: string) => Promise<BlockResponse>;
  unblock: (actor: Actor, accountId: string) => Promise<BlockResponse>;
  listBlocked: (actor: Actor) => Promise<BlockListResponse>;
  report: (actor: Actor, input: CreateReportInput) => Promise<ReportResponse>;
  listMyReports: (actor: Actor) => Promise<{ data: ReportResponse[] }>;
}

export interface ModerationServiceDeps {
  repository: ModerationRepository;
  storage?: Storage | undefined;
  logger: Logger;
}

export function createModerationService({
  repository,
  storage,
  logger,
}: ModerationServiceDeps): ModerationService {
  async function toCard(card: CardRow) {
    return {
      accountId: card.accountId,
      accountType: card.accountType,
      displayName: card.displayName,
      handle: card.handle,
      displayPicUrl:
        card.displayPicKey && storage ? await storage.signedUrl(card.displayPicKey) : null,
    };
  }

  function toReport(row: ReportRow): ReportResponse {
    return {
      id: row.id,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  return {
    block: async (actor, accountId) => {
      if (accountId === actor.accountId) {
        throw new ValidationFailedError([
          { field: 'accountId', issue: 'You cannot block yourself.' },
        ]);
      }

      await repository.block(actor.accountId, accountId);

      // Deliberately *not* deleting follows or connections. The filter already hides everything in
      // both directions, and tearing down the relationships would make unblocking a different
      // thing from undoing a block — someone who blocks in anger and relents an hour later should
      // get their world back, not a cleared list.
      logger.info({ accountId: actor.accountId }, 'Account blocked');

      return { accountId, blocked: true };
    },

    unblock: async (actor, accountId) => {
      await repository.unblock(actor.accountId, accountId);

      return { accountId, blocked: false };
    },

    /** Only who the caller has blocked. Who has blocked *them* is never disclosed. */
    listBlocked: async (actor) => ({
      data: await Promise.all((await repository.listBlocked(actor.accountId)).map(toCard)),
    }),

    report: async (actor, input) => {
      if (input.subjectType === 'ACCOUNT' && input.subjectId === actor.accountId) {
        throw new ValidationFailedError([
          { field: 'subjectId', issue: 'You cannot report yourself.' },
        ]);
      }

      if (!(await repository.subjectExists(input.subjectType, input.subjectId))) {
        throw new NotFoundError();
      }

      const row = await repository.report({
        reporterAccountId: actor.accountId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        reason: input.reason,
      });

      // Logged at info deliberately: until there is a review queue, the log is the only place a
      // human could notice a report at all.
      logger.info(
        { reportId: row.id, subjectType: row.subjectType, subjectId: row.subjectId },
        'Content reported',
      );

      return toReport(row);
    },

    listMyReports: async (actor) => ({
      data: (await repository.listMyReports(actor.accountId)).map(toReport),
    }),
  };
}
