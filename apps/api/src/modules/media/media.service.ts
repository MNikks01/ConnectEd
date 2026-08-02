/**
 * Media uploads.
 *
 * This module deliberately does **not** decide who may view an object. It hands back an opaque
 * key; the module that owns the resource referencing that key decides whether to issue a signed
 * URL. Putting the decision here would mean media had to understand classes, memberships, and
 * verification — the coupling `.docs/Architecture/01-modules.md` exists to prevent.
 *
 * What it does own is that only a real image, within the size limit, ever reaches the bucket — and,
 * since S3-12, what happened to it afterwards. An upload and the row referencing it are two
 * requests; when the second never arrives, the object is left with nothing pointing at it. Every
 * upload is recorded here, modules `claim` the keys they attach, and the sweep deletes what stayed
 * unclaimed past the grace period.
 */
import { detectImageType, type Storage } from '../../shared/storage/index.js';
import { ValidationFailedError } from '../../shared/errors/index.js';

import type { MediaRepository } from './media.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Logger } from '../../shared/logger/index.js';

export interface UploadResult {
  key: string;
  contentType: string;
  size: number;
}

export interface MediaService {
  uploadImage: (
    actor: Actor,
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    prefix: string,
  ) => Promise<UploadResult>;
  /** Called by the module that attaches a key to one of its rows. */
  claim: (key: string) => Promise<void>;
  /**
   * Deletes objects nothing ever referenced. Returns what it removed, so a scheduled run can say
   * something more useful than "done".
   */
  sweepOrphans: (options?: { graceHours?: number; limit?: number }) => Promise<{ deleted: number }>;
}

export interface MediaServiceDeps {
  storage: Storage;
  logger: Logger;
  maxBytes: number;
  /** Absent when the app is built without a database; uploads then go unrecorded and unswept. */
  repository?: MediaRepository | undefined;
  /** Injected for tests; the sweep is time-dependent by nature. */
  now?: (() => Date) | undefined;
}

/**
 * How long an object may sit unclaimed before it is assumed abandoned.
 *
 * Long enough to cover a slow client, a retry, and a user who left a form open over lunch; short
 * enough that a leaked upload does not linger for weeks. The cost of being wrong in one direction
 * is a deleted image the user was about to attach; in the other, a bucket that only grows.
 */
const DEFAULT_GRACE_HOURS = 24;

/** A bounded batch, so one sweep cannot spend an hour deleting. */
const DEFAULT_LIMIT = 500;

/** Only these prefixes may be written, so a caller cannot scatter objects across the bucket. */
const ALLOWED_PREFIXES = new Set(['academic-items', 'timetables', 'avatars', 'posts']);

export function createMediaService({
  storage,
  logger,
  maxBytes,
  repository,
  now = () => new Date(),
}: MediaServiceDeps): MediaService {
  return {
    claim: async (key) => {
      await repository?.claim(key);
    },

    /**
     * Storage first, then the row. If the delete succeeds and the row survives, the next sweep
     * finds a key that is already gone and removes the row — harmless. The other order would drop
     * the only record of an object that is still in the bucket, which is unrecoverable.
     */
    sweepOrphans: async ({ graceHours = DEFAULT_GRACE_HOURS, limit = DEFAULT_LIMIT } = {}) => {
      if (!repository) return { deleted: 0 };

      const cutoff = new Date(now().getTime() - graceHours * 3600_000);
      const orphans = await repository.findOrphans(cutoff, limit);

      if (orphans.length === 0) return { deleted: 0 };

      const removed: string[] = [];

      for (const orphan of orphans) {
        try {
          await storage.remove(orphan.key);
          removed.push(orphan.key);
        } catch (error) {
          // One unreachable object must not stop the batch. It stays unclaimed and is retried on
          // the next run, which is the right behaviour for a transient storage failure.
          logger.warn({ key: orphan.key, error }, 'Could not delete an orphaned object');
        }
      }

      await repository.forget(removed);

      logger.info({ deleted: removed.length, graceHours }, 'Swept orphaned uploads');

      return { deleted: removed.length };
    },

    uploadImage: async (actor, file, prefix) => {
      if (!file) {
        throw new ValidationFailedError([{ field: 'file', issue: 'A file is required.' }]);
      }

      if (!ALLOWED_PREFIXES.has(prefix)) {
        throw new ValidationFailedError([{ field: 'prefix', issue: 'Unknown upload category.' }]);
      }

      if (file.size > maxBytes) {
        throw new ValidationFailedError([
          {
            field: 'file',
            issue: `Files must be ${Math.floor(maxBytes / 1024 / 1024)}MB or smaller.`,
          },
        ]);
      }

      // The declared mimetype is ignored entirely; only the bytes decide.
      const contentType = detectImageType(file.buffer);

      if (!contentType) {
        throw new ValidationFailedError([
          { field: 'file', issue: 'Only JPEG, PNG, and WebP images are accepted.' },
        ]);
      }

      const stored = await storage.putImage({ body: file.buffer, contentType, prefix });

      // Recorded *after* the write: a row for an object that does not exist would send the sweep
      // looking for something it can never delete.
      await repository?.record({
        key: stored.key,
        prefix,
        contentType: stored.contentType,
        sizeBytes: stored.size,
        uploadedBy: actor.accountId,
      });

      logger.info(
        { accountId: actor.accountId, key: stored.key, size: stored.size, contentType },
        'Media uploaded',
      );

      return { key: stored.key, contentType: stored.contentType, size: stored.size };
    },
  };
}
