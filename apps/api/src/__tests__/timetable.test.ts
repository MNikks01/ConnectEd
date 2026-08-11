/**
 * Class timetables — S2-9 (FR-ACAD-020).
 *
 * Two rules carry the feature. Only the school uploads, which is narrower than every other
 * academic write so far — not even the class teacher of that class. And the signed URL is issued
 * only after the caller has been proved a verified member, so the object key never becomes the
 * authorization boundary.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { Storage } from '../shared/storage/index.js';
import type { TimetableResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

/** Records what was signed, so "signed only after authorization" is assertable. */
const signed: string[] = [];

function fakeStorage(): Storage {
  return {
    putImage: ({ body, contentType, prefix }) =>
      Promise.resolve({ key: `${prefix}/x.bin`, contentType, size: body.length }),
    putObject: ({ key, body }) => Promise.resolve({ key, size: body.length }),
    signedUrlTtlSeconds: 300,
    signedUrl: (key) => {
      signed.push(key);
      return Promise.resolve(`https://signed.test/${key}?sig=x`);
    },
    remove: () => Promise.resolve(),
    ping: () => Promise.resolve(),
    ensureBucket: () => Promise.resolve(),
  };
}

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ db, config, storage: fakeStorage() });
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
  signed.length = 0;
});

async function auth(accountId: string, kind: 'SCHOOL' | 'INDIVIDUAL', role?: string) {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: kind,
    ...(role ? { role: role as never } : {}),
  });
  return `Bearer ${token}`;
}

const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL');
const asPrincipal = () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL');
const asClassTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asParent = () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'STUDENT');

async function upload(classId = fixture.classAId, imageKey = 'timetables/one.png') {
  return request(app)
    .post(`/api/v1/classes/${classId}/timetable`)
    .set('Authorization', await asSchool())
    .send({ imageKey });
}

describe('POST /classes/:id/timetable — uploading (FR-ACAD-020)', () => {
  it('lets the school upload, starting at version 1', async () => {
    const response = await upload();

    expect(response.status).toBe(201);
    expect(bodyAs<TimetableResponse>(response).version).toBe(1);
  });

  it('keeps the previous version rather than replacing it', async () => {
    await upload(fixture.classAId, 'timetables/one.png');
    const second = await upload(fixture.classAId, 'timetables/two.png');

    expect(bodyAs<TimetableResponse>(second).version).toBe(2);
    // The history is the point: someone always needs to know what it said last week.
    expect(await db.timetable.count({ where: { classId: fixture.classAId } })).toBe(2);
  });

  it.each([
    ['the class teacher', () => asClassTeacher()],
    ['the principal', () => asPrincipal()],
    ['a student', () => asStudent()],
    ['a parent', () => asParent()],
  ])('refuses %s — uploading is the school’s alone', async (_label, authorization) => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await authorization())
      .send({ imageKey: 'timetables/sneaky.png' });

    expect(response.status).toBe(403);
    expect(await db.timetable.count()).toBe(0);
  });

  it('refuses another school with 404, without confirming the class exists', async () => {
    const rival = await db.account.create({
      data: {
        email: `rival-tt-${Date.now()}@fixture.test`,
        type: 'SCHOOL',
        schoolProfile: { create: { name: 'Rival School' } },
      },
      select: { id: true },
    });

    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await auth(rival.id, 'SCHOOL'))
      .send({ imageKey: 'timetables/theirs.png' });

    expect(response.status).toBe(404);
  });

  it('rejects a missing image key before it reaches the database', async () => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await asSchool())
      .send({});

    expect(response.status).toBe(422);
  });
});

describe('GET /classes/:id/timetable — viewing', () => {
  it.each([
    ['a student', () => asStudent()],
    ['the class teacher', () => asClassTeacher()],
    ['the principal', () => asPrincipal()],
    ['the school', () => asSchool()],
  ])('lets %s see the current one', async (_label, authorization) => {
    await upload();

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await authorization());

    expect(response.status).toBe(200);
    expect(bodyAs<TimetableResponse>(response).imageUrl).toContain('https://signed.test/');
  });

  it('returns the latest version, not the first', async () => {
    await upload(fixture.classAId, 'timetables/one.png');
    await upload(fixture.classAId, 'timetables/two.png');

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await asStudent());

    const body = bodyAs<TimetableResponse>(response);
    expect(body.version).toBe(2);
    expect(body.imageUrl).toContain('two.png');
  });

  it('refuses a member of another class, and signs nothing for them', async () => {
    await upload();
    signed.length = 0;

    // The student is in class A; class B is not theirs.
    await upload(fixture.classBId, 'timetables/b.png');
    signed.length = 0;

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classBId}/timetable`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(403);
    // The refusal must happen before the URL is minted, or the key becomes the boundary.
    expect(signed).toHaveLength(0);
  });

  it('refuses someone with no membership at the school at all', async () => {
    await upload();

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(403);
  });

  it('says so plainly when no timetable has been uploaded', async () => {
    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(404);
  });

  it('lists the history newest first', async () => {
    await upload(fixture.classAId, 'timetables/one.png');
    await upload(fixture.classAId, 'timetables/two.png');
    await upload(fixture.classAId, 'timetables/three.png');

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/timetable/versions`)
      .set('Authorization', await asStudent());

    expect(bodyAs<{ data: TimetableResponse[] }>(response).data.map((row) => row.version)).toEqual([
      3, 2, 1,
    ]);
  });

  it('refuses the history to a non-member too', async () => {
    await upload();

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/timetable/versions`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(403);
  });
});
