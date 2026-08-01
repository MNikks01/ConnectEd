/**
 * Media uploads.
 *
 * This module deliberately does **not** decide who may view an object. It hands back an opaque
 * key; the module that owns the resource referencing that key decides whether to issue a signed
 * URL. Putting the decision here would mean media had to understand classes, memberships, and
 * verification — the coupling `.docs/Architecture/01-modules.md` exists to prevent.
 *
 * What it does own is that only a real image, within the size limit, ever reaches the bucket.
 */
import { detectImageType, type Storage } from '../../shared/storage/index.js';
import { ValidationFailedError } from '../../shared/errors/index.js';

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
}

export interface MediaServiceDeps {
  storage: Storage;
  logger: Logger;
  maxBytes: number;
}

/** Only these prefixes may be written, so a caller cannot scatter objects across the bucket. */
const ALLOWED_PREFIXES = new Set(['academic-items', 'timetables', 'avatars', 'posts']);

export function createMediaService({ storage, logger, maxBytes }: MediaServiceDeps): MediaService {
  return {
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

      logger.info(
        { accountId: actor.accountId, key: stored.key, size: stored.size, contentType },
        'Media uploaded',
      );

      return { key: stored.key, contentType: stored.contentType, size: stored.size };
    },
  };
}
