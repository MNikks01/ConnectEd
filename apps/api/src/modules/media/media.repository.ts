/**
 * Uploaded-object bookkeeping. **The only file in this module that touches Prisma.**
 */
import type { Db } from '../../shared/db/index.js';

export interface MediaObjectRow {
  key: string;
  prefix: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface MediaRepository {
  record: (input: {
    key: string;
    prefix: string;
    contentType: string;
    sizeBytes: number;
    uploadedBy: string;
  }) => Promise<void>;
  /**
   * Marks the key as referenced by something. Idempotent, and deliberately silent about a key it
   * has never seen: a module attaching an object uploaded before this table existed must not fail
   * for it.
   */
  claim: (key: string) => Promise<void>;
  /** Unclaimed and older than the cutoff, oldest first. */
  findOrphans: (cutoff: Date, limit: number) => Promise<MediaObjectRow[]>;
  forget: (keys: string[]) => Promise<void>;
}

export function createMediaRepository(db: Db): MediaRepository {
  return {
    record: async (input) => {
      await db.mediaObject.create({ data: input });
    },

    claim: async (key) => {
      await db.mediaObject.updateMany({
        // `claimedAt: null` keeps the first claim's timestamp: re-attaching the same image to a
        // second item should not restart any clock.
        where: { key, claimedAt: null },
        data: { claimedAt: new Date() },
      });
    },

    findOrphans: async (cutoff, limit) =>
      db.mediaObject.findMany({
        where: { claimedAt: null, createdAt: { lt: cutoff } },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: { key: true, prefix: true, uploadedBy: true, createdAt: true },
      }),

    forget: async (keys) => {
      if (keys.length === 0) return;
      await db.mediaObject.deleteMany({ where: { key: { in: keys } } });
    },
  };
}
