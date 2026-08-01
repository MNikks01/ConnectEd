/**
 * Syllabus coverage — S2-10 (FR-ACAD-030, 031).
 *
 * The write policy is deliberately the *same object* as the one publishing homework uses, so the
 * interesting tests are the ones proving that: a teacher records for their own subject and is
 * refused another's, while every verified member of the class can read either.
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
import type { SyllabusCoverageResponse, SyllabusTopicResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

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
/** Allocated to Mathematics, and class teacher of class A. */
const asMathsTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
/** Allocated to Science, in the same class. */
const asScienceTeacher = () => auth(fixture.otherTeacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asParent = () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'STUDENT');

async function record(
  authorization: string,
  topic: string,
  percent: number,
  subjectId = fixture.mathsSubjectId,
) {
  return request(app)
    .post(`/api/v1/subjects/${subjectId}/syllabus`)
    .set('Authorization', authorization)
    .send({ topic, percent });
}

describe('POST /subjects/:id/syllabus — recording (FR-ACAD-030)', () => {
  it('lets the allocated teacher record a topic', async () => {
    const response = await record(await asMathsTeacher(), 'Chapter 1: Integers', 40);

    expect(response.status).toBe(200);
    const body = bodyAs<SyllabusTopicResponse>(response);
    expect(body.percent).toBe(40);
    expect(body.updatedByAccountId).toBe(fixture.teacherAccountId);
    expect(body.updatedByName).toBeTruthy();
  });

  it('updates rather than duplicating when the same topic is recorded again', async () => {
    await record(await asMathsTeacher(), 'Chapter 1: Integers', 40);
    const second = await record(await asMathsTeacher(), 'Chapter 1: Integers', 75);

    expect(bodyAs<SyllabusTopicResponse>(second).percent).toBe(75);
    expect(await db.syllabusProgress.count({ where: { subjectId: fixture.mathsSubjectId } })).toBe(
      1,
    );
  });

  it('lets the school record for its own subject', async () => {
    const response = await record(await asSchool(), 'Chapter 2', 10);

    expect(response.status).toBe(200);
  });

  it('refuses a teacher of a different subject in the same class', async () => {
    const response = await record(await asScienceTeacher(), 'Chapter 1: Integers', 90);

    expect(response.status).toBe(403);
    expect(await db.syllabusProgress.count()).toBe(0);
  });

  it.each([
    ['the principal', () => asPrincipal()],
    ['a student', () => asStudent()],
    ['a parent', () => asParent()],
  ])('refuses %s — coverage is the teacher’s to record', async (_label, authorization) => {
    const response = await record(await authorization(), 'Chapter 1', 100);

    expect(response.status).toBe(403);
    expect(await db.syllabusProgress.count()).toBe(0);
  });

  it('rejects a percentage outside 0–100', async () => {
    const tooHigh = await record(await asMathsTeacher(), 'Chapter 1', 140);
    const negative = await record(await asMathsTeacher(), 'Chapter 1', -5);

    expect(tooHigh.status).toBe(422);
    expect(negative.status).toBe(422);
  });

  it('rejects a fractional percentage rather than rounding silently', async () => {
    const response = await record(await asMathsTeacher(), 'Chapter 1', 33.3);

    expect(response.status).toBe(422);
  });

  it('answers 404 for a subject that does not exist', async () => {
    const response = await request(app)
      .post(`/api/v1/subjects/${crypto.randomUUID()}/syllabus`)
      .set('Authorization', await asMathsTeacher())
      .send({ topic: 'Nowhere', percent: 10 });

    expect(response.status).toBe(404);
  });
});

describe('GET /subjects/:id/syllabus — viewing (FR-ACAD-031)', () => {
  it.each([
    ['a student', () => asStudent()],
    ['the class teacher', () => asMathsTeacher()],
    ['another teacher of the class', () => asScienceTeacher()],
    ['the principal', () => asPrincipal()],
    ['the school', () => asSchool()],
  ])('lets %s read coverage', async (_label, authorization) => {
    await record(await asMathsTeacher(), 'Chapter 1', 50);

    const response = await request(app)
      .get(`/api/v1/subjects/${fixture.mathsSubjectId}/syllabus`)
      .set('Authorization', await authorization());

    expect(response.status).toBe(200);
    expect(bodyAs<SyllabusCoverageResponse>(response).topics).toHaveLength(1);
  });

  it('refuses someone outside the school', async () => {
    await record(await asMathsTeacher(), 'Chapter 1', 50);

    const response = await request(app)
      .get(`/api/v1/subjects/${fixture.mathsSubjectId}/syllabus`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(403);
  });

  it('averages the topics, and reports zero when nothing is recorded', async () => {
    const empty = await request(app)
      .get(`/api/v1/subjects/${fixture.mathsSubjectId}/syllabus`)
      .set('Authorization', await asStudent());

    expect(bodyAs<SyllabusCoverageResponse>(empty).overallPercent).toBe(0);

    await record(await asMathsTeacher(), 'Chapter 1', 100);
    await record(await asMathsTeacher(), 'Chapter 2', 50);
    await record(await asMathsTeacher(), 'Chapter 3', 0);

    const response = await request(app)
      .get(`/api/v1/subjects/${fixture.mathsSubjectId}/syllabus`)
      .set('Authorization', await asStudent());

    expect(bodyAs<SyllabusCoverageResponse>(response).overallPercent).toBe(50);
  });

  it('lists topics by name, so the syllabus reads in order', async () => {
    await record(await asMathsTeacher(), 'Chapter 2', 10);
    await record(await asMathsTeacher(), 'Chapter 1', 10);
    await record(await asMathsTeacher(), 'Chapter 3', 10);

    const response = await request(app)
      .get(`/api/v1/subjects/${fixture.mathsSubjectId}/syllabus`)
      .set('Authorization', await asStudent());

    expect(bodyAs<SyllabusCoverageResponse>(response).topics.map((topic) => topic.topic)).toEqual([
      'Chapter 1',
      'Chapter 2',
      'Chapter 3',
    ]);
  });

  it('keeps each subject’s coverage to itself', async () => {
    await record(await asMathsTeacher(), 'Maths chapter', 60);
    await record(await asScienceTeacher(), 'Science chapter', 20, fixture.scienceSubjectId);

    const maths = await request(app)
      .get(`/api/v1/subjects/${fixture.mathsSubjectId}/syllabus`)
      .set('Authorization', await asStudent());

    const topics = bodyAs<SyllabusCoverageResponse>(maths).topics;
    expect(topics).toHaveLength(1);
    expect(topics[0]?.topic).toBe('Maths chapter');
  });
});

describe('GET /classes/:id/syllabus — the whole class at once', () => {
  it('returns one entry per subject, whether or not anything is recorded', async () => {
    await record(await asMathsTeacher(), 'Chapter 1', 60);

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/syllabus`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(200);

    const { data } = bodyAs<{ data: SyllabusCoverageResponse[] }>(response);
    // Mathematics and Science: the untouched subject is present at 0 rather than absent, so a
    // parent sees which subjects have recorded nothing.
    expect(data).toHaveLength(2);
    expect(data.find((entry) => entry.subjectName === 'Mathematics')?.overallPercent).toBe(60);
    expect(data.find((entry) => entry.subjectName === 'Science')?.overallPercent).toBe(0);
  });

  it('refuses a member of another class', async () => {
    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classBId}/syllabus`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(403);
  });

  /**
   * The reason this endpoint exists. Asking per subject, a class with no subjects never reaches a
   * policy at all — so a stranger could tell an empty class from one that does not exist.
   */
  it('refuses a stranger even when the class has no subjects', async () => {
    const empty = await db.class.create({
      data: {
        schoolId: fixture.schoolAccountId,
        medium: 'ENGLISH',
        level: 'CLASS_7',
        section: 'D',
      },
      select: { id: true },
    });

    const response = await request(app)
      .get(`/api/v1/classes/${empty.id}/syllabus`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(403);
  });
});

describe('DELETE /syllabus/:id — correcting', () => {
  it('lets the allocated teacher remove a topic', async () => {
    const created = bodyAs<SyllabusTopicResponse>(
      await record(await asMathsTeacher(), 'Recorded by mistake', 10),
    );

    const response = await request(app)
      .delete(`/api/v1/syllabus/${created.id}`)
      .set('Authorization', await asMathsTeacher());

    expect(response.status).toBe(204);
    expect(await db.syllabusProgress.count()).toBe(0);
  });

  it('refuses a teacher of another subject', async () => {
    const created = bodyAs<SyllabusTopicResponse>(
      await record(await asMathsTeacher(), 'Chapter 1', 10),
    );

    const response = await request(app)
      .delete(`/api/v1/syllabus/${created.id}`)
      .set('Authorization', await asScienceTeacher());

    expect(response.status).toBe(403);
    expect(await db.syllabusProgress.count()).toBe(1);
  });

  it('refuses a student', async () => {
    const created = bodyAs<SyllabusTopicResponse>(
      await record(await asMathsTeacher(), 'Chapter 1', 10),
    );

    const response = await request(app)
      .delete(`/api/v1/syllabus/${created.id}`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(403);
  });
});
