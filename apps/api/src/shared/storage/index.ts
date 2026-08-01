/**
 * Object storage (ADR-0009). S3-compatible, MinIO locally.
 *
 * Two decisions worth knowing:
 *
 * **Objects are private and read through short-lived signed URLs.** A public bucket would mean a
 * homework photo is readable by anyone who learns the URL, forever — and school content includes
 * children's work. Signing also puts the authorization decision back where it belongs: the module
 * that owns the resource decides whether to hand out a URL at all.
 *
 * **Keys are unguessable.** A key embeds a UUID rather than the original filename, so possession
 * of a key is not a substitute for authorization but at least cannot be arrived at by guessing
 * `/uploads/homework-1.jpg`.
 */
import { randomUUID } from 'node:crypto';

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { extensionFor, type AllowedImageType } from './file-type.js';

import type { Config } from '../config/index.js';
import type { Logger } from '../logger/index.js';

/** Long enough to load a page, short enough that a leaked URL stops working quickly. */
const SIGNED_URL_TTL_SECONDS = 300;

export interface StoredObject {
  key: string;
  contentType: AllowedImageType;
  size: number;
}

export interface Storage {
  putImage: (input: {
    body: Buffer;
    contentType: AllowedImageType;
    /** Groups keys by purpose, e.g. `academic-items`. Never client-supplied. */
    prefix: string;
  }) => Promise<StoredObject>;
  /** A time-limited URL. Callers must authorize *before* asking for one. */
  signedUrl: (key: string) => Promise<string>;
  remove: (key: string) => Promise<void>;
  /** Readiness probe target. */
  ping: () => Promise<void>;
  ensureBucket: () => Promise<void>;
}

export function createStorage(config: Config, logger: Logger): Storage {
  const client = new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    // MinIO serves buckets as a path, not a subdomain; real S3 does the opposite.
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY,
      secretAccessKey: config.S3_SECRET_KEY,
    },
  });

  const bucket = config.S3_BUCKET;

  return {
    putImage: async ({ body, contentType, prefix }) => {
      const key = `${prefix}/${randomUUID()}.${extensionFor(contentType)}`;

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // Belt and braces: even if the bucket policy were loosened, this object is not public.
          ACL: 'private',
        }),
      );

      return { key, contentType, size: body.length };
    },

    signedUrl: (key: string) =>
      getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: SIGNED_URL_TTL_SECONDS,
      }),

    remove: async (key: string) => {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    ping: async () => {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    },

    /**
     * Local convenience only. Deployed environments create buckets through Terraform, where
     * retention, versioning, and access policy are set alongside them — none of which belongs in
     * application startup.
     */
    ensureBucket: async () => {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
          logger.info({ bucket }, 'Created object storage bucket');
        } catch (error) {
          logger.error({ err: error, bucket }, 'Could not create object storage bucket');
        }
      }
    },
  };
}

export { ALLOWED_IMAGE_TYPES, detectImageType, type AllowedImageType } from './file-type.js';
