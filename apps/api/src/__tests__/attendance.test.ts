/**
 * Attendance — S8-4 (FR-ATT-001 … 031).
 *
 * Two things are being checked here that the gradebook's suite could not.
 *
 * The first is that **the product does not contradict itself**: a school that accepted a child's
 * leave must not then offer to mark them absent on that day. That rule joins two modules through
 * the pupil link, and it is the reason this feature is worth more than a table of four states.
 *
 * The second is the *difference* from the gradebook: a register is a class-level fact, so a teacher
 * of any subject in the class reads all of it — where the same teacher is refused another subject's
 * marks. If that distinction is wrong, it is wrong here.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { membershipScopeKey } from '../shared/db/membership-scope.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { MyAttendanceResponse, RegisterResponse } from '@connected/types';
import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

/** The fixture's class teacher for class A is the main teacher. */
const asClassTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL', 'SCHOOL');

const TODAY = new Date().toISOString().slice(0, 10);

async function auth(accountId: string, kind: 'INDIVIDUAL' | 'SCHOOL', role?: string) {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: kind,
    ...(role ? { role: role as never } : {}),
  });
  return `Bearer ${token}`;
}

function register(date = TODAY) {
  return request(app).get(`/api/v1/classes/${fixture.classAId}/register?date=${date}`);
}

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ config, logger, db });
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
});

afterAll(async () => {
  await closeTestDb();
});

describe('taking a register', () => {
  it('records the class in one action', async () => {
    const response = await request(app)
      .put(`/api/v1/classes/${fixture.classAId}/register`)
      .send({
        onDate: TODAY,
        entries: [{ studentAccountId: fixture.studentAccountId, state: 'ABSENT' }],
      })
      .set('Authorization', await asClassTeacher());

    expect(response.status).toBe(204);

    const taken = await register().set('Authorization', await asClassTeacher());
    const body = bodyAs<RegisterResponse>(taken);
    expect(body.takenAt).not.toBeNull();
    expect(body.entries[0]?.state).toBe('ABSENT');
  });

  it('updates rather than adding a second answer about the same child', async () => {
    const take = async (state: string) =>
      request(app)
        .put(`/api/v1/classes/${fixture.classAId}/register`)
        .send({ onDate: TODAY, entries: [{ studentAccountId: fixture.studentAccountId, state }] })
        .set('Authorization', await asClassTeacher());

    await take('PRESENT');
    await take('ABSENT');

    expect(await db.attendanceEntry.count({ where: { classId: fixture.classAId } })).toBe(1);
  });

  it('audits an amendment, and not the first taking', async () => {
    const take = async (state: string) =>
      request(app)
        .put(`/api/v1/classes/${fixture.classAId}/register`)
        .send({ onDate: TODAY, entries: [{ studentAccountId: fixture.studentAccountId, state }] })
        .set('Authorization', await asClassTeacher());

    await take('PRESENT');
    expect(await db.auditLog.count({ where: { action: 'attendance.amended' } })).toBe(0);

    await take('ABSENT');
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: 'attendance.amended' } });
    const metadata = entry.metadata as { previousState: string; newState: string };
    expect(metadata.previousState).toBe('PRESENT');
    expect(metadata.newState).toBe('ABSENT');
  });

  it('refuses a future date, because tomorrow is not a fact', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const response = await request(app)
      .put(`/api/v1/classes/${fixture.classAId}/register`)
      .send({
        onDate: tomorrow,
        entries: [{ studentAccountId: fixture.studentAccountId, state: 'PRESENT' }],
      })
      .set('Authorization', await asClassTeacher());

    expect(response.status).toBe(422);
  });

  it('refuses a pupil who is not a verified student of the class', async () => {
    const response = await request(app)
      .put(`/api/v1/classes/${fixture.classAId}/register`)
      .send({
        onDate: TODAY,
        entries: [{ studentAccountId: fixture.outsiderAccountId, state: 'PRESENT' }],
      })
      .set('Authorization', await asClassTeacher());

    expect(response.status).toBe(404);
  });
});

describe('the absence the school already agreed to', () => {
  /** An accepted leave for the fixture's student, covering today. */
  async function acceptedLeaveForStudent(): Promise<void> {
    await db.leaveApplication.create({
      data: {
        kind: 'STUDENT',
        applicantAccountId: fixture.studentAccountId,
        classId: fixture.classAId,
        schoolId: fixture.schoolAccountId,
        startDate: new Date(`${TODAY}T00:00:00.000Z`),
        endDate: new Date(`${TODAY}T00:00:00.000Z`),
        reason: 'Dentist',
        status: 'ACCEPTED',
      },
    });
  }

  it('offers EXCUSED for a pupil the school gave leave to', async () => {
    await acceptedLeaveForStudent();

    const response = await register().set('Authorization', await asClassTeacher());
    const entry = bodyAs<RegisterResponse>(response).entries.find(
      (row) => row.studentAccountId === fixture.studentAccountId,
    );

    // The alternative is a school marking a child absent on a day it agreed they could be away,
    // and then telling the parent about it.
    expect(entry?.state).toBe('EXCUSED');
    expect(entry?.fromLeave).toBe(true);
  });

  it('offers PRESENT when there is no leave', async () => {
    const response = await register().set('Authorization', await asClassTeacher());
    const entry = bodyAs<RegisterResponse>(response).entries.find(
      (row) => row.studentAccountId === fixture.studentAccountId,
    );

    expect(entry?.state).toBe('PRESENT');
    expect(entry?.fromLeave).toBe(false);
  });

  it('lets a teacher override the offer — the leave is a fact, the register is a judgement', async () => {
    await acceptedLeaveForStudent();

    await request(app)
      .put(`/api/v1/classes/${fixture.classAId}/register`)
      .send({
        onDate: TODAY,
        entries: [{ studentAccountId: fixture.studentAccountId, state: 'PRESENT' }],
      })
      .set('Authorization', await asClassTeacher())
      .expect(204);

    const response = await register().set('Authorization', await asClassTeacher());
    const entry = bodyAs<RegisterResponse>(response).entries.find(
      (row) => row.studentAccountId === fixture.studentAccountId,
    );

    expect(entry?.state).toBe('PRESENT');
    // Not attributed to the leave: the pupil turned up after all, and saying "excused — leave
    // accepted" against a teacher's own answer would be the product arguing with them.
    expect(entry?.fromLeave).toBe(false);
  });
});

describe('who may take it', () => {
  it.each([
    [
      'a teacher who is not the class teacher',
      () => auth(fixture.otherTeacherAccountId, 'INDIVIDUAL', 'TEACHER'),
    ],
    ['a principal', () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL')],
    ['a student', () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT')],
    ['a parent', () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT')],
    ['an outsider', () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER')],
  ])('refuses %s', async (_name, actor) => {
    const response = await request(app)
      .put(`/api/v1/classes/${fixture.classAId}/register`)
      .send({
        onDate: TODAY,
        entries: [{ studentAccountId: fixture.studentAccountId, state: 'PRESENT' }],
      })
      .set('Authorization', await actor());

    expect(response.status).toBe(403);
    expect(await db.attendanceEntry.count()).toBe(0);
  });

  it('allows the school', async () => {
    const response = await request(app)
      .put(`/api/v1/classes/${fixture.classAId}/register`)
      .send({
        onDate: TODAY,
        entries: [{ studentAccountId: fixture.studentAccountId, state: 'LATE' }],
      })
      .set('Authorization', await asSchool());

    expect(response.status).toBe(204);
  });
});

describe('who may read it', () => {
  it('a teacher of another subject in the class reads the whole register', async () => {
    // The deliberate difference from marks, where the same teacher is refused. Knowing who is in
    // the room is part of teaching it, whatever you teach.
    const response = await register().set(
      'Authorization',
      await auth(fixture.otherTeacherAccountId, 'INDIVIDUAL', 'TEACHER'),
    );

    expect(response.status).toBe(200);
  });

  it('the principal reads it', async () => {
    const response = await register().set(
      'Authorization',
      await auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL'),
    );

    expect(response.status).toBe(200);
  });

  it('a pupil cannot read the whole register', async () => {
    const response = await register().set(
      'Authorization',
      await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'),
    );

    expect(response.status).toBe(403);
  });

  it('an outsider cannot', async () => {
    const response = await register().set(
      'Authorization',
      await auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER'),
    );

    expect(response.status).toBe(403);
  });

  it('refuses an unauthenticated caller', async () => {
    expect((await register()).status).toBe(401);
  });
});

describe('a pupil and their parent', () => {
  async function takeToday(state = 'ABSENT'): Promise<void> {
    await request(app)
      .put(`/api/v1/classes/${fixture.classAId}/register`)
      .send({ onDate: TODAY, entries: [{ studentAccountId: fixture.studentAccountId, state }] })
      .set('Authorization', await asClassTeacher())
      .expect(204);
  }

  it('a pupil sees their own days', async () => {
    await takeToday();

    const response = await request(app)
      .get(`/api/v1/me/classes/${fixture.classAId}/attendance`)
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    const { data } = bodyAs<{ data: MyAttendanceResponse[] }>(response);
    expect(data).toHaveLength(1);
    expect(data[0]?.state).toBe('ABSENT');
  });

  it('a parent sees their own child’s, through the school-confirmed link', async () => {
    await db.child.update({
      where: { id: fixture.childId },
      data: { classId: fixture.classAId, studentAccountId: fixture.studentAccountId },
    });
    await db.membership.updateMany({
      where: { accountId: fixture.parentAccountId, childId: fixture.childId },
      data: {
        classId: fixture.classAId,
        scopeKey: membershipScopeKey(fixture.classAId, fixture.childId),
      },
    });
    await takeToday();

    const response = await request(app)
      .get(`/api/v1/children/${fixture.childId}/attendance`)
      .set('Authorization', await auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT'));

    expect(response.status).toBe(200);
    expect(bodyAs<{ data: MyAttendanceResponse[] }>(response).data[0]?.state).toBe('ABSENT');
  });

  it('a parent is refused while the school has not linked the child', async () => {
    await takeToday();

    const response = await request(app)
      .get(`/api/v1/children/${fixture.childId}/attendance`)
      .set('Authorization', await auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT'));

    expect(response.status).toBe(404);
  });

  it('a parent cannot read another family’s child', async () => {
    const response = await request(app)
      .get(`/api/v1/children/${fixture.childId}/attendance`)
      .set('Authorization', await auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER'));

    expect(response.status).toBe(404);
  });
});
