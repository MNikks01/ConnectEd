/**
 * Export and erasure (`.docs/PRD/14-export-and-erasure.md`).
 *
 * **The authorization here is the simplest in the product and the least forgiving.** Every other
 * module asks "may this actor reach this resource?" and answers with a role, a membership and a
 * verification state. These endpoints ask only "is this your own account?", and the answer is the
 * actor's own id or nothing. There is no scope to widen and no role that grants somebody else's
 * data — which is why a mistake here would not look like a bug so much as a breach.
 *
 * So: no id is ever taken from the request for the thing being acted on. `requestExport` exports
 * `actor.accountId`; `requestErasure` erases `actor.accountId`. The one route that does take an id
 * is the download, and it re-reads the row and compares owners before signing anything.
 */
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/index.js';

import { buildIndividualBundle, buildSchoolBundle } from './export-bundle.js';
import { ERASURE_GRACE_DAYS } from './privacy.repository.js';

import type { Actor } from '../../shared/authz/index.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type { PrivacyRepository } from './privacy.repository.js';
import type { DataExport, ErasureRequest } from '../../generated/prisma/client.js';
import type {
  DataExportDownloadResponse,
  DataExportResponse,
  ErasureRequestResponse,
  PrivacyStatusResponse,
  RequestErasureInput,
} from '@connected/types';

export interface PrivacyService {
  status: (actor: Actor) => Promise<PrivacyStatusResponse>;
  requestExport: (actor: Actor) => Promise<DataExportResponse>;
  listExports: (actor: Actor) => Promise<DataExportResponse[]>;
  downloadExport: (actor: Actor, exportId: string) => Promise<DataExportDownloadResponse>;
  requestErasure: (actor: Actor, input: RequestErasureInput) => Promise<ErasureRequestResponse>;
  cancelErasure: (actor: Actor) => Promise<void>;

  /** Worker entry points. Nobody is waiting on any of these. */
  buildPendingExports: () => Promise<void>;
  expireExports: () => Promise<void>;
  executeDueErasures: () => Promise<void>;
}

export interface PrivacyServiceDeps {
  repository: PrivacyRepository;
  db: Db;
  logger: Logger;
  /**
   * Absent when the app is built without object storage. Requesting an export is then refused
   * rather than accepted and silently never built — a pending row nothing can finish is a worse
   * answer than "not available".
   */
  storage?: Storage | undefined;
}

function toExportResponse(row: DataExport): DataExportResponse {
  return {
    id: row.id,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    sizeBytes: row.sizeBytes,
    downloads: row.downloads,
    error: row.error,
  };
}

function toErasureResponse(row: ErasureRequest): ErasureRequestResponse {
  return {
    id: row.id,
    requestedAt: row.requestedAt.toISOString(),
    scheduledFor: row.scheduledFor.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    executedAt: row.executedAt?.toISOString() ?? null,
    reason: row.reason,
  };
}

export function createPrivacyService({
  repository,
  db,
  logger,
  storage,
}: PrivacyServiceDeps): PrivacyService {
  /** A school is a controller, not merely a subject (FR-DSR-020, ADR-0020). */
  const mayErase = (actor: Actor): boolean => actor.accountType !== 'SCHOOL';

  async function buildOne(row: DataExport): Promise<void> {
    if (!storage) return;

    try {
      const account = await db.account.findUnique({
        where: { id: row.accountId },
        select: { type: true, status: true },
      });

      if (!account) throw new Error('The account no longer exists.');

      // An account erased between requesting and building. The bundle would be a file of empty
      // sections, and building it would mean writing a copy of somebody's data to a bucket
      // moments after promising to delete it.
      if (account.status === 'ERASED') {
        await repository.markExportFailed(
          row.id,
          'This account was erased before the export could be built.',
        );
        return;
      }

      const bundle =
        account.type === 'SCHOOL'
          ? await buildSchoolBundle(db, row.accountId)
          : await buildIndividualBundle(db, row.accountId);

      const body = Buffer.from(JSON.stringify(bundle, null, 2), 'utf8');

      // The key embeds the export id rather than the account id. Object keys are unguessable
      // either way, but an account id in a key is one more place the identifier turns up, and the
      // export id is the only thing that needs to be recoverable from it.
      const { key, size } = await storage.putObject({
        key: `exports/${row.id}.json`,
        body,
        contentType: 'application/json',
      });

      await repository.markExportReady(row.id, { objectKey: key, sizeBytes: size });

      logger.info(
        { exportId: row.id, sizeBytes: size, sections: Object.keys(bundle.sections).length },
        'Data export built',
      );
    } catch (error) {
      logger.error({ err: error, exportId: row.id }, 'Data export failed');

      // Deliberately not the error's message: it is written to a screen the owner reads, and an
      // internal message there is both unhelpful and a small information leak (FR-DSR-007).
      await repository.markExportFailed(
        row.id,
        'Something went wrong while preparing your export. Please request it again.',
      );
    }
  }

  return {
    status: async (actor) => {
      const [latest, erasure] = await Promise.all([
        repository.latestExport(actor.accountId),
        repository.pendingErasure(actor.accountId),
      ]);

      return {
        latestExport: latest ? toExportResponse(latest) : null,
        pendingErasure: erasure ? toErasureResponse(erasure) : null,
        mayErase: mayErase(actor),
      };
    },

    requestExport: async (actor) => {
      if (!storage) {
        throw new ConflictError('Exports are not available on this deployment.');
      }

      // FR-DSR-028. Building a copy of a person hours before deleting them produces a bundle
      // whose owner will not exist to download it, and an object in a bucket with nobody to reach
      // it — the one ordering that leaves personal data behind after an erasure.
      if (await repository.pendingErasure(actor.accountId)) {
        throw new ConflictError(
          'Your account is scheduled for erasure. Cancel that first if you want an export.',
        );
      }

      const outstanding = await repository.outstandingExport(actor.accountId);

      // A conflict rather than a queue: the second request would produce a byte-identical answer
      // to the first, and two bundles of the same person is one more copy than anybody asked for.
      if (outstanding) {
        throw new ConflictError('An export is already being prepared. It will be ready shortly.');
      }

      const row = await repository.createExport(actor.accountId);
      logger.info({ exportId: row.id }, 'Data export requested');

      return toExportResponse(row);
    },

    listExports: async (actor) =>
      (await repository.listExports(actor.accountId)).map(toExportResponse),

    downloadExport: async (actor, exportId) => {
      if (!storage) throw new NotFoundError();

      const row = await repository.findExport(exportId);

      // Somebody else's export is not merely forbidden, it is out of scope — 404 rather than 403,
      // so the endpoint cannot be used to confirm that a given export exists
      // (`.docs/API/01-conventions.md`).
      if (!row || row.accountId !== actor.accountId) throw new NotFoundError();

      if (row.status !== 'READY' || !row.objectKey) {
        throw new ConflictError(
          row.status === 'EXPIRED'
            ? 'That export has expired. Request a new one.'
            : 'That export is not ready yet.',
        );
      }

      const url = await storage.signedUrl(row.objectKey);

      // Counted after the URL is minted, not before: a signing failure that still incremented the
      // counter would make the audit trail say a download happened that never did (FR-DSR-006).
      await repository.recordDownload(row.id);

      await db.auditLog.create({
        data: {
          actorAccountId: actor.accountId,
          action: 'privacy.export.downloaded',
          entity: 'data_export',
          entityId: row.id,
        },
      });

      return {
        url,
        expiresAt: new Date(Date.now() + storage.signedUrlTtlSeconds * 1000).toISOString(),
      };
    },

    requestErasure: async (actor, input) => {
      if (!mayErase(actor)) {
        // Explained rather than merely refused. A school reading "forbidden" would reasonably
        // conclude the product had lost its erasure feature, when in fact its situation is
        // different in kind from a person's.
        throw new ForbiddenError(
          'A school account cannot be erased here: its records belong to its pupils and their families as much as to the institution. Contact us to close a school account.',
        );
      }

      const existing = await repository.pendingErasure(actor.accountId);
      if (existing) {
        throw new ConflictError('Your account is already scheduled for erasure.');
      }

      const scheduledFor = new Date(Date.now() + ERASURE_GRACE_DAYS * 24 * 60 * 60 * 1000);
      const row = await repository.createErasure(actor.accountId, scheduledFor, input.reason);

      await db.auditLog.create({
        data: {
          actorAccountId: actor.accountId,
          action: 'account.erasure_requested',
          entity: 'account',
          entityId: actor.accountId,
          metadata: { requestId: row.id, scheduledFor: scheduledFor.toISOString() },
        },
      });

      logger.warn({ accountId: actor.accountId, scheduledFor }, 'Account erasure scheduled');

      return toErasureResponse(row);
    },

    cancelErasure: async (actor) => {
      const existing = await repository.pendingErasure(actor.accountId);
      if (!existing) throw new NotFoundError();

      await repository.cancelErasure(existing.id);

      await db.auditLog.create({
        data: {
          actorAccountId: actor.accountId,
          action: 'account.erasure_cancelled',
          entity: 'account',
          entityId: actor.accountId,
          metadata: { requestId: existing.id },
        },
      });

      logger.info({ accountId: actor.accountId }, 'Account erasure cancelled');
    },

    buildPendingExports: async () => {
      if (!storage) return;

      // Rows a dead worker left mid-build. Done first so a reclaimed row is picked up in the same
      // pass rather than waiting for the next one.
      const reclaimed = await repository.reclaimStuckExports(new Date());
      if (reclaimed > 0) {
        logger.warn({ reclaimed }, 'Reclaimed exports left building by a previous process');
      }

      // Bounded per pass. Each bundle is a couple of dozen queries against one account, and a
      // hundred of them at once would be a self-inflicted load test on the database the API is
      // sharing.
      const claimed = await repository.claimPendingExports(5);

      for (const row of claimed) {
        await buildOne(row);
      }
    },

    expireExports: async () => {
      const expired = await repository.expireExports(new Date());

      for (const row of expired) {
        if (!row.objectKey || !storage) continue;

        try {
          await storage.remove(row.objectKey);
        } catch (error) {
          // The row is already `EXPIRED`, so the bundle is unreachable through the product either
          // way. Logged rather than retried, because the alternative — leaving the row `READY`
          // when the object may already be gone — hands out signed URLs to a 404.
          logger.error(
            { err: error, key: row.objectKey },
            'Could not delete expired export object',
          );
        }
      }

      if (expired.length > 0) {
        logger.info({ expired: expired.length }, 'Expired data exports swept');
      }
    },

    executeDueErasures: async () => {
      const due = await repository.dueErasures(new Date());

      for (const request of due) {
        try {
          const { counts, mediaKeys } = await repository.executeErasure(request);

          // After the commit, deliberately. An object deleted inside the transaction would be gone
          // even if the transaction then rolled back, and an erasure that half-happened is the one
          // outcome FR-DSR-025 is written to prevent. The cost of this ordering is an orphaned
          // object if the process dies here, which the media sweep already collects.
          for (const key of mediaKeys) {
            try {
              await storage?.remove(key);
            } catch (error) {
              logger.error({ err: error, key }, 'Could not delete media for an erased account');
            }
          }

          logger.warn(
            { accountId: request.accountId, requestId: request.id, counts },
            'Account erased',
          );
        } catch (error) {
          // Left due, so the next pass tries again. An erasure that fails is not an erasure that
          // is cancelled, and nothing here may quietly decide otherwise on the subject's behalf.
          logger.error(
            { err: error, accountId: request.accountId, requestId: request.id },
            'Account erasure failed and will be retried',
          );
        }
      }
    },
  };
}
