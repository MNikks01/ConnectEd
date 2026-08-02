/**
 * Orphaned upload collection — S3-12.
 *
 * An upload and the row that references it are two requests. When the second never arrives, the
 * object sits in the bucket with nothing pointing at it — a gap carried since S2-0a. These tests
 * hold the two halves of the fix: an attached key is never swept, and an abandoned one is, but not
 * before the grace period.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createMediaModule } from '../modules/media/index.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { Storage } from '../shared/storage/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

/** In-memory bucket: the point is what gets deleted, not how S3 behaves. */
const bucket = new Map<string, Buffer>();
let counter = 0;

function fakeStorage(): Storage {
  return {
    putImage: ({ body, contentType, prefix }) => {
      counter += 1;
      const key = `${prefix}/${counter}.bin`;
      bucket.set(key, body);
      return Promise.resolve({ key, contentType, size: body.length });
    },
    signedUrl: (key) => Promise.resolve(`https://signed.test/${key}`),
    remove: (key) => {
      bucket.delete(key);
      return Promise.resolve();
    },
    ping: () => Promise.resolve(),
    ensureBucket: () => Promise.resolve(),
  };
}

/** A real PNG signature, since the upload path checks the bytes. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);

const storage = fakeStorage();

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ db, config, storage });
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
  bucket.clear();
});

async function auth(accountId: string, kind: 'SCHOOL' | 'INDIVIDUAL', role?: string) {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: kind,
    ...(role ? { role: role as never } : {}),
  });
  return `Bearer ${token}`;
}

async function upload(prefix = 'academic-items'): Promise<string> {
  const response = await request(app)
    .post(`/api/v1/media/${prefix}`)
    .set('Authorization', await auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'))
    .attach('file', PNG, 'image.png');

  expect(response.status, `setup: upload failed — ${response.text}`).toBe(201);

  return bodyAs<{ key: string }>(response).key;
}

/** Backdates a row so a sweep with the real grace period considers it. */
async function age(key: string, hours: number): Promise<void> {
  await db.mediaObject.update({
    where: { key },
    data: { createdAt: new Date(Date.now() - hours * 3600_000) },
  });
}

function mediaService() {
  return createMediaModule(storage, logger, config.MAX_UPLOAD_BYTES, db).service;
}

describe('recording an upload', () => {
  it('writes a row nothing has claimed yet', async () => {
    const key = await upload();

    const row = await db.mediaObject.findUnique({ where: { key } });
    expect(row).toMatchObject({
      prefix: 'academic-items',
      uploadedBy: fixture.teacherAccountId,
      claimedAt: null,
    });
  });
});

describe('the sweep', () => {
  it('deletes an upload nothing ever referenced', async () => {
    const key = await upload();
    await age(key, 48);

    expect(await mediaService().sweepOrphans()).toEqual({ deleted: 1 });

    expect(bucket.has(key)).toBe(false);
    expect(await db.mediaObject.findUnique({ where: { key } })).toBeNull();
  });

  it('leaves a recent upload alone — the second request may still be coming', async () => {
    const key = await upload();

    expect(await mediaService().sweepOrphans()).toEqual({ deleted: 0 });
    expect(bucket.has(key)).toBe(true);
  });

  /** The half that matters: a published image must survive any number of sweeps. */
  it('never touches a key an academic item references', async () => {
    const key = await upload();

    const published = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'))
      .send({
        type: 'HOMEWORK',
        subjectId: fixture.mathsSubjectId,
        title: 'With a picture',
        body: 'See the diagram.',
        imageKey: key,
      });
    expect(published.status).toBe(201);

    await age(key, 48);

    expect(await mediaService().sweepOrphans()).toEqual({ deleted: 0 });
    expect(bucket.has(key)).toBe(true);
  });

  it('never touches a key a timetable references', async () => {
    const key = await upload('timetables');

    const uploaded = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'))
      .send({ imageKey: key });
    expect(uploaded.status).toBe(201);

    await age(key, 48);

    expect(await mediaService().sweepOrphans()).toEqual({ deleted: 0 });
    expect(bucket.has(key)).toBe(true);
  });

  it('respects the grace period boundary', async () => {
    const key = await upload();
    await age(key, 2);

    // Three-hour grace: a two-hour-old upload is still within it.
    expect(await mediaService().sweepOrphans({ graceHours: 3 })).toEqual({ deleted: 0 });
    // One-hour grace: now it is not.
    expect(await mediaService().sweepOrphans({ graceHours: 1 })).toEqual({ deleted: 1 });
  });

  it('is idempotent — a second run finds nothing left', async () => {
    const key = await upload();
    await age(key, 48);

    expect(await mediaService().sweepOrphans()).toEqual({ deleted: 1 });
    expect(await mediaService().sweepOrphans()).toEqual({ deleted: 0 });
  });

  it('keeps the row when the object cannot be deleted, so the next run retries', async () => {
    const key = await upload();
    await age(key, 48);

    const failing: Storage = {
      ...storage,
      remove: () => Promise.reject(new Error('bucket unreachable')),
    };

    const service = createMediaModule(failing, logger, config.MAX_UPLOAD_BYTES, db).service;

    expect(await service.sweepOrphans()).toEqual({ deleted: 0 });
    // Still recorded, so it is not lost track of.
    expect(await db.mediaObject.findUnique({ where: { key } })).not.toBeNull();

    // And a later run with working storage finishes the job.
    expect(await mediaService().sweepOrphans()).toEqual({ deleted: 1 });
  });

  it('honours the batch limit', async () => {
    const keys = [await upload(), await upload(), await upload()];
    for (const key of keys) await age(key, 48);

    expect(await mediaService().sweepOrphans({ limit: 2 })).toEqual({ deleted: 2 });
    expect(await mediaService().sweepOrphans({ limit: 2 })).toEqual({ deleted: 1 });
  });

  it('claims only once, keeping the first timestamp', async () => {
    const key = await upload();
    const service = mediaService();

    await service.claim(key);
    const first = await db.mediaObject.findUnique({ where: { key } });

    await service.claim(key);
    const second = await db.mediaObject.findUnique({ where: { key } });

    expect(first?.claimedAt).not.toBeNull();
    expect(second?.claimedAt?.getTime()).toBe(first?.claimedAt?.getTime());
  });

  it('says nothing about a key it has never seen', async () => {
    // An object uploaded before this table existed must not make an attach fail.
    await expect(mediaService().claim('academic-items/unknown.bin')).resolves.toBeUndefined();
  });
});
