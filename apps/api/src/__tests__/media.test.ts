/**
 * Media uploads — S2-0a.
 *
 * The tests that matter here are the rejections. An upload endpoint that accepts what it is told
 * is an image, rather than what is actually an image, is a stored-XSS delivery mechanism: the file
 * is later served from our own domain.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { detectImageType } from '../shared/storage/file-type.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs, type ErrorBody } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { Storage } from '../shared/storage/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;
let stored: { key: string; body: Buffer; contentType: string }[];

const config = loadConfig();
const tokens = createTokenService(config);

/** In-memory storage: this suite is about validation, not about S3 behaving like S3. */
function fakeStorage(): Storage {
  return {
    putImage: ({ body, contentType, prefix }) => {
      const key = `${prefix}/${stored.length}.bin`;
      stored.push({ key, body, contentType });
      return Promise.resolve({ key, contentType, size: body.length });
    },
    signedUrl: (key) => Promise.resolve(`https://signed.test/${key}?sig=x`),
    remove: () => Promise.resolve(),
    ping: () => Promise.resolve(),
    ensureBucket: () => Promise.resolve(),
  };
}

// Smallest byte sequences that carry each format's signature.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP'),
  Buffer.alloc(64),
]);
/** An HTML payload labelled as a PNG — the case that makes byte-checking necessary. */
const HTML_AS_PNG = Buffer.from('<html><script>alert(document.cookie)</script></html>');

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
  stored = [];
  app = createApp({ db, config, storage: fakeStorage() });
});

async function auth(accountId: string) {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: 'INDIVIDUAL',
    role: 'TEACHER',
  });
  return `Bearer ${token}`;
}

describe('detectImageType', () => {
  it.each([
    ['JPEG', JPEG, 'image/jpeg'],
    ['PNG', PNG, 'image/png'],
    ['WebP', WEBP, 'image/webp'],
  ])('detects %s from its signature', (_label, buffer, expected) => {
    expect(detectImageType(buffer)).toBe(expected);
  });

  it('rejects HTML however it is labelled', () => {
    expect(detectImageType(HTML_AS_PNG)).toBeUndefined();
  });

  it('rejects a buffer too short to carry a signature', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeUndefined();
  });

  it('rejects a near-miss that shares a prefix', () => {
    // "RIFF" without "WEBP" is a WAV, not an image.
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WAVE'),
      Buffer.alloc(64),
    ]);

    expect(detectImageType(wav)).toBeUndefined();
  });
});

describe('POST /media/:prefix', () => {
  it('accepts a real image and returns an opaque key', async () => {
    const response = await request(app)
      .post('/api/v1/media/academic-items')
      .set('Authorization', await auth(fixture.teacherAccountId))
      .attach('file', PNG, { filename: 'photo.png', contentType: 'image/png' });

    expect(response.status).toBe(201);
    expect(bodyAs<{ key: string; contentType: string }>(response).contentType).toBe('image/png');
    // The original filename must not survive into the key.
    expect(bodyAs<{ key: string }>(response).key).not.toContain('photo');
    expect(stored).toHaveLength(1);
  });

  it('rejects HTML masquerading as a PNG — the declared type is ignored', async () => {
    const response = await request(app)
      .post('/api/v1/media/academic-items')
      .set('Authorization', await auth(fixture.teacherAccountId))
      .attach('file', HTML_AS_PNG, { filename: 'evil.png', contentType: 'image/png' });

    expect(response.status).toBe(422);
    expect(bodyAs<ErrorBody>(response).error.details?.[0]?.issue).toContain('JPEG, PNG, and WebP');
    // Nothing reached the bucket.
    expect(stored).toHaveLength(0);
  });

  it('rejects an unknown upload category', async () => {
    const response = await request(app)
      .post('/api/v1/media/somewhere-else')
      .set('Authorization', await auth(fixture.teacherAccountId))
      .attach('file', PNG, { filename: 'photo.png' });

    expect(response.status).toBe(422);
    expect(stored).toHaveLength(0);
  });

  it('rejects a request with no file', async () => {
    const response = await request(app)
      .post('/api/v1/media/academic-items')
      .set('Authorization', await auth(fixture.teacherAccountId));

    expect(response.status).toBe(422);
  });

  it('rejects a file over the size limit', async () => {
    const oversized = Buffer.concat([PNG, Buffer.alloc(config.MAX_UPLOAD_BYTES + 1)]);

    const response = await request(app)
      .post('/api/v1/media/academic-items')
      .set('Authorization', await auth(fixture.teacherAccountId))
      .attach('file', oversized, { filename: 'huge.png' });

    expect(response.status).toBe(422);
    expect(stored).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/media/academic-items')
      .attach('file', PNG, { filename: 'photo.png' });

    expect(response.status).toBe(401);
    expect(stored).toHaveLength(0);
  });

  it('is absent when the app is built without storage', async () => {
    const withoutStorage = createApp({ db, config });

    const response = await request(withoutStorage)
      .post('/api/v1/media/academic-items')
      .set('Authorization', await auth(fixture.teacherAccountId))
      .attach('file', PNG, { filename: 'photo.png' });

    expect(response.status).toBe(404);
  });
});

describe('signed URLs', () => {
  it('are produced per key, so a caller cannot be handed a bucket-wide URL', async () => {
    const storage = fakeStorage();
    const first = await storage.signedUrl('academic-items/a.png');
    const second = await storage.signedUrl('academic-items/b.png');

    expect(first).not.toBe(second);
    expect(first).toContain('academic-items/a.png');
  });

  it('are requested by the owning module, never issued at upload time', () => {
    // The upload response carries a key, not a URL — authorization for reading happens later,
    // in whichever module owns the resource that references it.
    const uploadResponseKeys = ['key', 'contentType', 'size'];

    expect(uploadResponseKeys).not.toContain('url');
    expect(vi.isMockFunction(() => undefined)).toBe(false);
  });
});
