/**
 * Data access for export and erasure. Prisma lives here and nowhere else in this module
 * (`apps/api/CLAUDE.md` rule 1).
 *
 * Two things in here are not ordinary CRUD and are worth reading before the rest.
 *
 * **`claimPendingExports` is a queue.** The `data_export` row *is* the work item — there is no
 * BullMQ job behind it — so claiming has to be safe against a second worker, which is what
 * `FOR UPDATE SKIP LOCKED` buys, exactly as it does for the outbox relay (ADR-0019).
 *
 * **`executeErasure` is the only irreversible statement in the product.** It runs the whole
 * disposition and the audit row in one transaction (FR-DSR-025), because a half-erased account is
 * strictly worse than an un-erased one: nobody can sign into it and the data is still there.
 */
import { recordEvent } from '../../shared/outbox/index.js';

import { eraseAccount, type ErasureCounts } from './erasure.js';

import type { Db } from '../../shared/db/index.js';
import type { DataExport, ErasureRequest } from '../../generated/prisma/client.js';

/**
 * How long a built bundle stays downloadable (FR-DSR-005). A policy number, not a technical one —
 * see "why an export expires" in the PRD.
 */
export const EXPORT_TTL_DAYS = 7;

/** The grace period before an erasure executes (FR-DSR-021). */
export const ERASURE_GRACE_DAYS = 30;

/**
 * How long a `BUILDING` row may sit before it is treated as abandoned.
 *
 * A worker that dies mid-build leaves a row nothing will ever finish, and without this the owner's
 * only symptom is an export that is permanently "being prepared". Generous on purpose: reclaiming
 * a build that is merely slow costs a duplicate bundle, and the bundle is idempotent.
 */
const STUCK_BUILD_MINUTES = 30;

export interface PrivacyRepository {
  createExport: (accountId: string) => Promise<DataExport>;
  findExport: (id: string) => Promise<DataExport | null>;
  latestExport: (accountId: string) => Promise<DataExport | null>;
  listExports: (accountId: string) => Promise<DataExport[]>;
  /** Anything not yet finished — the guard behind "one at a time" (FR-DSR-001). */
  outstandingExport: (accountId: string) => Promise<DataExport | null>;

  claimPendingExports: (limit: number) => Promise<DataExport[]>;
  markExportReady: (
    id: string,
    result: { objectKey: string; sizeBytes: number },
  ) => Promise<DataExport>;
  markExportFailed: (id: string, message: string) => Promise<void>;
  recordDownload: (id: string) => Promise<void>;
  /** Returns the keys whose objects the caller must now delete from the bucket. */
  expireExports: (now: Date) => Promise<{ id: string; objectKey: string | null }[]>;
  reclaimStuckExports: (now: Date) => Promise<number>;

  createErasure: (
    accountId: string,
    scheduledFor: Date,
    reason: string | undefined,
  ) => Promise<ErasureRequest>;
  pendingErasure: (accountId: string) => Promise<ErasureRequest | null>;
  cancelErasure: (id: string) => Promise<ErasureRequest>;
  dueErasures: (now: Date) => Promise<ErasureRequest[]>;
  executeErasure: (
    request: ErasureRequest,
  ) => Promise<{ counts: ErasureCounts; mediaKeys: string[] }>;
}

export interface PrivacyRepositoryDeps {
  db: Db;
  /**
   * The same hash the login throttle is keyed on. Injected rather than recomputed here so there is
   * exactly one definition of it in the codebase — two would mean an erasure that silently failed
   * to clear a throttle, which nobody would notice until somebody re-registered.
   */
  hashEmail: (email: string) => string;
}

export function createPrivacyRepository({
  db,
  hashEmail,
}: PrivacyRepositoryDeps): PrivacyRepository {
  return {
    createExport: (accountId) => db.dataExport.create({ data: { accountId } }),

    findExport: (id) => db.dataExport.findUnique({ where: { id } }),

    latestExport: (accountId) =>
      db.dataExport.findFirst({ where: { accountId }, orderBy: { requestedAt: 'desc' } }),

    listExports: (accountId) =>
      db.dataExport.findMany({ where: { accountId }, orderBy: { requestedAt: 'desc' }, take: 20 }),

    outstandingExport: (accountId) =>
      db.dataExport.findFirst({
        where: { accountId, status: { in: ['PENDING', 'BUILDING'] } },
        orderBy: { requestedAt: 'desc' },
      }),

    /**
     * Claim and mark in one transaction. The `SKIP LOCKED` is what makes a second worker safe: it
     * steps over the rows the first is holding instead of blocking on them or, worse, building the
     * same bundle twice and leaving one of the two objects orphaned in the bucket.
     */
    claimPendingExports: (limit) =>
      db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM data_export
          WHERE status = 'PENDING'
          ORDER BY requested_at
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        `;

        const ids = rows.map((row) => row.id);
        if (ids.length === 0) return [];

        await tx.dataExport.updateMany({
          where: { id: { in: ids } },
          data: { status: 'BUILDING', startedAt: new Date() },
        });

        return tx.dataExport.findMany({ where: { id: { in: ids } } });
      }),

    /**
     * The status change and the "it is ready" event commit together (ADR-0019). Without the
     * outbox this is the exact failure the outbox exists for: the row says `READY`, the enqueue
     * fails, and the only person who asked is never told — an export that is finished and
     * invisible.
     */
    markExportReady: (id, { objectKey, sizeBytes }) =>
      db.$transaction(async (tx) => {
        const completedAt = new Date();
        const expiresAt = new Date(completedAt.getTime() + EXPORT_TTL_DAYS * 24 * 60 * 60 * 1000);

        const row = await tx.dataExport.update({
          where: { id },
          data: {
            status: 'READY',
            objectKey,
            sizeBytes,
            completedAt,
            expiresAt,
            error: null,
          },
        });

        await recordEvent(tx, {
          type: 'privacy.export.ready',
          exportId: row.id,
          accountId: row.accountId,
          expiresAt: expiresAt.toISOString(),
        });

        return row;
      }),

    markExportFailed: async (id, message) => {
      await db.dataExport.update({ where: { id }, data: { status: 'FAILED', error: message } });
    },

    recordDownload: async (id) => {
      await db.dataExport.update({ where: { id }, data: { downloads: { increment: 1 } } });
    },

    expireExports: async (now) => {
      const due = await db.dataExport.findMany({
        where: { status: 'READY', expiresAt: { lte: now } },
        select: { id: true, objectKey: true },
      });

      if (due.length > 0) {
        await db.dataExport.updateMany({
          where: { id: { in: due.map((row) => row.id) } },
          // The key is cleared as well as the status: it names an object that is about to stop
          // existing, and a row pointing at a deleted object is a 404 waiting to be reported as a
          // bug.
          data: { status: 'EXPIRED', objectKey: null },
        });
      }

      return due;
    },

    reclaimStuckExports: async (now) => {
      const cutoff = new Date(now.getTime() - STUCK_BUILD_MINUTES * 60 * 1000);

      const { count } = await db.dataExport.updateMany({
        where: { status: 'BUILDING', startedAt: { lt: cutoff } },
        data: { status: 'PENDING', startedAt: null },
      });

      return count;
    },

    createErasure: (accountId, scheduledFor, reason) =>
      db.erasureRequest.create({
        data: { accountId, scheduledFor, ...(reason ? { reason } : {}) },
      }),

    pendingErasure: (accountId) =>
      db.erasureRequest.findFirst({
        where: { accountId, cancelledAt: null, executedAt: null },
        orderBy: { requestedAt: 'desc' },
      }),

    cancelErasure: (id) =>
      db.erasureRequest.update({ where: { id }, data: { cancelledAt: new Date() } }),

    dueErasures: (now) =>
      db.erasureRequest.findMany({
        where: { cancelledAt: null, executedAt: null, scheduledFor: { lte: now } },
        orderBy: { scheduledFor: 'asc' },
      }),

    executeErasure: (request) =>
      db.$transaction(
        async (tx) => {
          const outcome = await eraseAccount(tx, request.accountId, hashEmail);

          await tx.erasureRequest.update({
            where: { id: request.id },
            data: { executedAt: new Date() },
          });

          // The audit row outlives its subject, which is the point (ADR-0020). It names an id that
          // no longer resolves to a person, and the counts are what makes "we erased this account"
          // a checkable claim rather than an assertion.
          await tx.auditLog.create({
            data: {
              actorAccountId: request.accountId,
              action: 'account.erased',
              entity: 'account',
              entityId: request.accountId,
              metadata: { requestId: request.id, counts: outcome.counts },
            },
          });

          return outcome;
        },
        // Twenty-odd statements across a well-connected schema. The default five seconds is sized
        // for a request handler; this runs in the worker with nobody waiting on it, and timing out
        // half way is precisely the outcome FR-DSR-025 exists to prevent.
        { timeout: 60_000, maxWait: 10_000 },
      ),
  };
}
