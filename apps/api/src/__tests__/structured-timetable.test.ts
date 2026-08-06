/**
 * The structured timetable — FR-ACAD-021.
 *
 * The PRD kept this on the roadmap with one line: *"v1 accepts image upload; structured later."*
 * Later is now, and the shape of the decision matters more than the feature. The structured week is
 * a **second representation, not a replacement**: FR-ACAD-020 asks for "image/structured", a school
 * that photographs the sheet on the wall is not doing it wrong, and version 4 being a grid after
 * three photographs is an ordinary history.
 *
 * What the structured form buys is the thing a photograph cannot give: the server can check it. Two
 * lessons at the same time on a Tuesday, or a period naming another class's subject, are refused
 * here. On an image nobody finds out until a class turns up in the wrong room.
 *
 * The authorization is unchanged and is asserted anyway — publishing is the school's alone, not the
 * class teacher's, and every verified member of the class may read.
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
import type { TimetablePeriodInput, TimetableResponse } from '@connected/types';
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
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asClassTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'STUDENT');

/** A small but realistic Monday: two lessons either side of a break. */
function aMonday(): TimetablePeriodInput[] {
  return [
    { day: 'MONDAY', startsAt: '09:00', endsAt: '09:45', subjectId: fixture.mathsSubjectId },
    { day: 'MONDAY', startsAt: '09:45', endsAt: '10:00', label: 'Break' },
    { day: 'MONDAY', startsAt: '10:00', endsAt: '10:45', subjectId: fixture.scienceSubjectId },
  ];
}

const publish = async (periods: TimetablePeriodInput[], classId = fixture.classAId) =>
  request(app)
    .post(`/api/v1/classes/${classId}/timetable`)
    .set('Authorization', await asSchool())
    .send({ periods });

describe('publishing a week', () => {
  it('stores it as version 1 and says which kind it is', async () => {
    const response = await publish(aMonday());

    expect(response.status, response.text).toBe(201);
    const body = bodyAs<TimetableResponse>(response);

    // Stated rather than inferred from which field happens to be null: a client rendering a grid
    // should not have to guess from `imageUrl === null`.
    expect(body.kind).toBe('STRUCTURED');
    expect(body.imageUrl).toBeNull();
    expect(body.version).toBe(1);
    expect(body.periods).toHaveLength(3);
  });

  it('resolves subject names, so a grid needs one request', async () => {
    const body = bodyAs<TimetableResponse>(await publish(aMonday()));
    const first = body.periods[0];

    expect(first?.subjectName).toBe('Mathematics');
    expect(first?.label).toBeNull();
  });

  it('keeps periods that are not subjects', async () => {
    const body = bodyAs<TimetableResponse>(await publish(aMonday()));
    const gap = body.periods.find((period) => period.label === 'Break');

    // A timetable has assemblies, breaks and games in it. Forcing those into a subject row would
    // put "Break" into every subject-scoped read in the product.
    expect(gap?.subjectId).toBeNull();
    expect(gap?.subjectName).toBeNull();
  });

  it('returns them in the order a week is read', async () => {
    await publish([
      { day: 'TUESDAY', startsAt: '11:00', endsAt: '11:45', label: 'Games' },
      { day: 'MONDAY', startsAt: '10:00', endsAt: '10:45', subjectId: fixture.scienceSubjectId },
      { day: 'MONDAY', startsAt: '09:00', endsAt: '09:45', subjectId: fixture.mathsSubjectId },
    ]);

    const body = bodyAs<TimetableResponse>(
      await request(app)
        .get(`/api/v1/classes/${fixture.classAId}/timetable`)
        .set('Authorization', await asStudent()),
    );

    expect(body.periods.map((period) => `${period.day} ${period.startsAt}`)).toEqual([
      'MONDAY 09:00',
      'MONDAY 10:00',
      'TUESDAY 11:00',
    ]);
  });
});

describe('what the server refuses', () => {
  it('refuses two lessons at the same time', async () => {
    const response = await publish([
      { day: 'MONDAY', startsAt: '09:00', endsAt: '10:00', subjectId: fixture.mathsSubjectId },
      { day: 'MONDAY', startsAt: '09:30', endsAt: '10:30', subjectId: fixture.scienceSubjectId },
    ]);

    // The whole reason to store a week as data rather than a picture.
    expect(response.status).toBe(422);
    expect(response.text).toContain('overlap');
  });

  it('allows one period to start exactly when another ends', async () => {
    const response = await publish([
      { day: 'MONDAY', startsAt: '09:00', endsAt: '10:00', subjectId: fixture.mathsSubjectId },
      { day: 'MONDAY', startsAt: '10:00', endsAt: '11:00', subjectId: fixture.scienceSubjectId },
    ]);

    // Touching is not overlapping, and a timetable that refused it would be unusable.
    expect(response.status).toBe(201);
  });

  it('lets the same time run on different days', async () => {
    const response = await publish([
      { day: 'MONDAY', startsAt: '09:00', endsAt: '10:00', subjectId: fixture.mathsSubjectId },
      { day: 'TUESDAY', startsAt: '09:00', endsAt: '10:00', subjectId: fixture.mathsSubjectId },
    ]);

    expect(response.status).toBe(201);
  });

  it('refuses a subject from another class', async () => {
    const elsewhere = await db.subject.create({
      data: { classId: fixture.classBId, name: 'Geography' },
      select: { id: true },
    });

    const response = await publish([
      { day: 'MONDAY', startsAt: '09:00', endsAt: '10:00', subjectId: elsewhere.id },
    ]);

    // Otherwise the grid renders a name from a class nobody in this one may read.
    expect(response.status).toBe(422);
    expect(response.text).toContain('not taught in this class');
  });

  it('refuses a period that ends before it starts', async () => {
    const response = await publish([
      { day: 'MONDAY', startsAt: '10:00', endsAt: '09:00', label: 'Time travel' },
    ]);

    expect(response.status).toBe(422);
  });

  it('refuses a period that is both a subject and a label', async () => {
    const response = await publish([
      {
        day: 'MONDAY',
        startsAt: '09:00',
        endsAt: '10:00',
        subjectId: fixture.mathsSubjectId,
        label: 'Also a break somehow',
      },
    ]);

    expect(response.status).toBe(422);
  });

  it('refuses a period that is neither', async () => {
    // No cast: the input type genuinely allows both to be absent, because zod expresses "exactly
    // one of these" as a refinement rather than in the type. That is the gap this asserts against.
    const response = await publish([{ day: 'MONDAY', startsAt: '09:00', endsAt: '10:00' }]);

    expect(response.status).toBe(422);
  });

  it('refuses a day nobody has', async () => {
    const response = await publish([
      { day: 'CATURDAY', startsAt: '09:00', endsAt: '10:00', label: 'Naps' } as never,
    ]);

    expect(response.status).toBe(422);
  });

  it('refuses a time that is not one', async () => {
    const response = await publish([
      { day: 'MONDAY', startsAt: '9am', endsAt: '10:00', label: 'Assembly' } as never,
    ]);

    expect(response.status).toBe(422);
  });

  it('refuses an empty week', async () => {
    const response = await publish([]);

    // Publishing nothing is not how you remove a timetable; it would read as "no lessons at all".
    expect(response.status).toBe(422);
  });

  it('refuses both an image and a week at once', async () => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await asSchool())
      .send({ imageKey: 'timetables/one.png', periods: aMonday() });

    // One version is one representation. Both would leave every reader deciding which is true.
    expect(response.status).toBe(422);
  });

  it('writes nothing when a week is refused', async () => {
    await publish([
      { day: 'MONDAY', startsAt: '09:00', endsAt: '10:00', subjectId: fixture.mathsSubjectId },
      { day: 'MONDAY', startsAt: '09:30', endsAt: '10:30', subjectId: fixture.scienceSubjectId },
    ]);

    // A rejected week must not leave a version behind, or the history grows entries nobody can read.
    expect(await db.timetable.count({ where: { classId: fixture.classAId } })).toBe(0);
    expect(await db.timetablePeriod.count()).toBe(0);
  });
});

describe('the two kinds live together', () => {
  it('lets a school move from photographs to a grid, keeping the history', async () => {
    await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await asSchool())
      .send({ imageKey: 'timetables/term-one.png' });

    const second = await publish(aMonday());

    expect(bodyAs<TimetableResponse>(second).version).toBe(2);
    expect(bodyAs<TimetableResponse>(second).kind).toBe('STRUCTURED');

    const history = bodyAs<{ data: TimetableResponse[] }>(
      await request(app)
        .get(`/api/v1/classes/${fixture.classAId}/timetable/versions`)
        .set('Authorization', await asStudent()),
    ).data;

    // Newest first, and each version says what it is. Someone always needs last week's.
    expect(history.map((row) => row.kind)).toEqual(['STRUCTURED', 'IMAGE']);
  });

  it('leaves an image version with no periods rather than an empty grid', async () => {
    await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await asSchool())
      .send({ imageKey: 'timetables/term-one.png' });

    const current = bodyAs<TimetableResponse>(
      await request(app)
        .get(`/api/v1/classes/${fixture.classAId}/timetable`)
        .set('Authorization', await asStudent()),
    );

    expect(current.kind).toBe('IMAGE');
    expect(current.periods).toEqual([]);
  });
});

describe('who may do what', () => {
  it('refuses the class teacher — publishing is the school’s alone', async () => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await asClassTeacher())
      .send({ periods: aMonday() });

    expect([403, 404]).toContain(response.status);
  });

  it('refuses another school’s class', async () => {
    const other = await seedSchool(db);

    const response = await request(app)
      .post(`/api/v1/classes/${other.classAId}/timetable`)
      .set('Authorization', await asSchool())
      .send({ periods: aMonday() });

    // 404, not 403: an unknown class and another school's class must be indistinguishable.
    expect(response.status).toBe(404);
  });

  it('refuses a reader who is not a verified member', async () => {
    await publish(aMonday());

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/timetable`)
      .set('Authorization', await asOutsider());

    expect([403, 404]).toContain(response.status);
  });

  it('refuses an unauthenticated caller', async () => {
    await publish(aMonday());

    expect((await request(app).get(`/api/v1/classes/${fixture.classAId}/timetable`)).status).toBe(
      401,
    );
  });
});
