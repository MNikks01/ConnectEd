/**
 * Institution endpoints — S1-1..S1-3 (FR-INST-001, 002, 003, 006).
 *
 * Every scoped endpoint is exercised as the owning school (**must succeed**) and as each actor who
 * must be refused: another school, a verified teacher, a principal, a student, and an outsider.
 * Only the positive half would pass against a service that forgot to authorize at all.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs, type ErrorBody } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { ClassResponse, SchoolProfileResponse, SubjectResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

interface ListBody<T> {
  data: T[];
}

const UNKNOWN_UUID = '11111111-1111-4111-8111-111111111111';

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ db, config });
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
});

/** Mints a real access token, so the tests exercise the same middleware production does. */
async function auth(accountId: string, kind: 'SCHOOL' | 'INDIVIDUAL', role?: string) {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: kind,
    ...(role ? { role: role as never } : {}),
  });
  return `Bearer ${token}`;
}

const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL');
const asTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asPrincipal = () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL');
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER');

/** A second school, to prove one school cannot touch another's structure. */
async function otherSchool() {
  const account = await db.account.create({
    data: {
      email: `rival-${Date.now()}@fixture.test`,
      type: 'SCHOOL',
      schoolProfile: { create: { name: 'Rival School' } },
    },
    select: { id: true },
  });
  return { id: account.id, authorization: await auth(account.id, 'SCHOOL') };
}

describe('GET /schools/:id', () => {
  it('returns the profile to the school itself', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}`)
      .set('Authorization', await asSchool());

    expect(response.status).toBe(200);
    expect(bodyAs<SchoolProfileResponse>(response).name).toBe('Fixture School');
  });

  it('is readable by any authenticated account — a prospective member must find the school', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(200);
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get(`/api/v1/schools/${fixture.schoolAccountId}`);

    expect(response.status).toBe(401);
  });

  it('404s for an unknown school', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${UNKNOWN_UUID}`)
      .set('Authorization', await asSchool());

    expect(response.status).toBe(404);
  });

  it('404s for a malformed id rather than failing in the database', async () => {
    const response = await request(app)
      .get('/api/v1/schools/not-a-uuid')
      .set('Authorization', await asSchool());

    expect(response.status).toBe(404);
    expect(bodyAs<ErrorBody>(response).error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /schools/:id', () => {
  const patch = { name: 'Renamed School', city: 'Pune' };

  it('lets the school update its own profile', async () => {
    const response = await request(app)
      .patch(`/api/v1/schools/${fixture.schoolAccountId}`)
      .set('Authorization', await asSchool())
      .send(patch);

    expect(response.status).toBe(200);
    expect(bodyAs<SchoolProfileResponse>(response).name).toBe('Renamed School');
  });

  it.each([
    ['a principal', () => asPrincipal()],
    ['a teacher', () => asTeacher()],
    ['a student', () => asStudent()],
    ['an outsider', () => asOutsider()],
  ])('refuses %s', async (_label, authorization) => {
    const response = await request(app)
      .patch(`/api/v1/schools/${fixture.schoolAccountId}`)
      .set('Authorization', await authorization())
      .send(patch);

    expect(response.status).toBe(403);
    const unchanged = await db.schoolProfile.findUnique({
      where: { accountId: fixture.schoolAccountId },
      select: { name: true },
    });
    expect(unchanged?.name).toBe('Fixture School');
  });

  it('refuses another school, hiding existence with 404', async () => {
    const rival = await otherSchool();

    const response = await request(app)
      .patch(`/api/v1/schools/${fixture.schoolAccountId}`)
      .set('Authorization', rival.authorization)
      .send(patch);

    expect(response.status).toBe(404);
  });

  it('rejects an invalid establishment year', async () => {
    const response = await request(app)
      .patch(`/api/v1/schools/${fixture.schoolAccountId}`)
      .set('Authorization', await asSchool())
      .send({ establishmentYear: 1200 });

    expect(response.status).toBe(422);
  });
});

describe('POST /schools/:id/classes', () => {
  const newClass = { medium: 'HINDI', level: 'CLASS_5', section: 'C' };

  it('lets the school create a class', async () => {
    const response = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', await asSchool())
      .send(newClass);

    expect(response.status).toBe(201);
    expect(bodyAs<ClassResponse>(response)).toMatchObject({
      medium: 'HINDI',
      level: 'CLASS_5',
      section: 'C',
      active: true,
      subjectCount: 0,
    });
  });

  it('derives a human-readable display name instead of a legacy string key', async () => {
    const response = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', await asSchool())
      .send(newClass);

    expect(bodyAs<ClassResponse>(response).displayName).toBe('Class 5-C (Hindi)');
  });

  it('rejects a duplicate class for the same school (FR-INST-002)', async () => {
    const response = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', await asSchool())
      // Already created by the fixture.
      .send({ medium: 'ENGLISH', level: 'CLASS_8', section: 'A' });

    expect(response.status).toBe(409);
  });

  it('allows the same class shape at a different school', async () => {
    const rival = await otherSchool();

    const response = await request(app)
      .post(`/api/v1/schools/${rival.id}/classes`)
      .set('Authorization', rival.authorization)
      .send({ medium: 'ENGLISH', level: 'CLASS_8', section: 'A' });

    expect(response.status).toBe(201);
  });

  it('rejects a level outside the taxonomy', async () => {
    const response = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', await asSchool())
      .send({ medium: 'ENGLISH', level: 'CLASS_13', section: 'A' });

    expect(response.status).toBe(422);
  });

  it.each([
    ['a principal', () => asPrincipal()],
    ['a teacher', () => asTeacher()],
    ['a student', () => asStudent()],
  ])('refuses %s', async (_label, authorization) => {
    const before = await db.class.count();

    const response = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', await authorization())
      .send(newClass);

    expect(response.status).toBe(403);
    expect(await db.class.count()).toBe(before);
  });

  it('refuses another school', async () => {
    const rival = await otherSchool();

    const response = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', rival.authorization)
      .send(newClass);

    expect(response.status).toBe(404);
  });
});

describe('GET /schools/:id/classes', () => {
  it('lists active classes for the school', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', await asSchool());

    expect(response.status).toBe(200);
    expect(bodyAs<ListBody<ClassResponse>>(response).data).toHaveLength(2);
  });

  it('is readable by a prospective member, who needs it to request verification', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(200);
    expect(bodyAs<ListBody<ClassResponse>>(response).data).toHaveLength(2);
  });

  it('hides deactivated classes from everyone by default', async () => {
    await db.class.update({ where: { id: fixture.classBId }, data: { active: false } });

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', await asSchool());

    expect(bodyAs<ListBody<ClassResponse>>(response).data).toHaveLength(1);
  });

  it('shows deactivated classes to the school when it asks', async () => {
    await db.class.update({ where: { id: fixture.classBId }, data: { active: false } });

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/classes?includeInactive=true`)
      .set('Authorization', await asSchool());

    expect(bodyAs<ListBody<ClassResponse>>(response).data).toHaveLength(2);
  });

  it('ignores includeInactive for anyone other than the owning school', async () => {
    await db.class.update({ where: { id: fixture.classBId }, data: { active: false } });

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/classes?includeInactive=true`)
      .set('Authorization', await asTeacher());

    expect(bodyAs<ListBody<ClassResponse>>(response).data).toHaveLength(1);
  });
});

describe('PATCH /classes/:id', () => {
  it('lets the school deactivate a class, retaining the data (FR-INST-006)', async () => {
    const response = await request(app)
      .patch(`/api/v1/classes/${fixture.classAId}`)
      .set('Authorization', await asSchool())
      .send({ active: false });

    expect(response.status).toBe(200);
    expect(bodyAs<ClassResponse>(response).active).toBe(false);
    expect(await db.class.findUnique({ where: { id: fixture.classAId } })).not.toBeNull();
  });

  it.each([
    ['a principal', () => asPrincipal()],
    ['a teacher', () => asTeacher()],
    ['a student', () => asStudent()],
  ])('refuses %s', async (_label, authorization) => {
    const response = await request(app)
      .patch(`/api/v1/classes/${fixture.classAId}`)
      .set('Authorization', await authorization())
      .send({ active: false });

    expect(response.status).toBe(403);
    const klass = await db.class.findUnique({
      where: { id: fixture.classAId },
      select: { active: true },
    });
    expect(klass?.active).toBe(true);
  });

  it('refuses another school with 404', async () => {
    const rival = await otherSchool();

    const response = await request(app)
      .patch(`/api/v1/classes/${fixture.classAId}`)
      .set('Authorization', rival.authorization)
      .send({ active: false });

    expect(response.status).toBe(404);
  });
});

describe('POST /classes/:id/subjects', () => {
  it('lets the school add a subject', async () => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/subjects`)
      .set('Authorization', await asSchool())
      .send({ name: 'History' });

    expect(response.status).toBe(201);
    expect(bodyAs<SubjectResponse>(response).name).toBe('History');
  });

  it('rejects a duplicate subject within the class', async () => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/subjects`)
      .set('Authorization', await asSchool())
      // The fixture already has Mathematics in class A.
      .send({ name: 'Mathematics' });

    expect(response.status).toBe(409);
  });

  it('allows the same subject name in a different class', async () => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classBId}/subjects`)
      .set('Authorization', await asSchool())
      .send({ name: 'Mathematics' });

    expect(response.status).toBe(201);
  });

  it.each([
    ['a principal', () => asPrincipal()],
    ['a teacher allocated to this class', () => asTeacher()],
    ['a student', () => asStudent()],
  ])('refuses %s — defining subjects is the school’s job', async (_label, authorization) => {
    const before = await db.subject.count();

    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/subjects`)
      .set('Authorization', await authorization())
      .send({ name: 'History' });

    expect(response.status).toBe(403);
    expect(await db.subject.count()).toBe(before);
  });

  it('rejects an empty name', async () => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/subjects`)
      .set('Authorization', await asSchool())
      .send({ name: '   ' });

    expect(response.status).toBe(422);
  });
});

describe('GET /classes/:id/subjects', () => {
  it('lists the subjects of a class', async () => {
    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/subjects`)
      .set('Authorization', await asSchool());

    expect(response.status).toBe(200);
    expect(bodyAs<ListBody<SubjectResponse>>(response).data.map((s) => s.name)).toEqual([
      'Mathematics',
      'Science',
    ]);
  });

  it('is readable by a teacher declaring which subjects they teach', async () => {
    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/subjects`)
      .set('Authorization', await asTeacher());

    expect(response.status).toBe(200);
  });

  it('404s for an unknown class', async () => {
    const response = await request(app)
      .get(`/api/v1/classes/${UNKNOWN_UUID}/subjects`)
      .set('Authorization', await asSchool());

    expect(response.status).toBe(404);
  });
});
