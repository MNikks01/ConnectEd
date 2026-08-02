/**
 * Leave applications — S3-1..S3-6 (FR-WF-001..006).
 *
 * The first endpoints where **who may decide depends on an allocation, not a role**.
 * `assertClassTeacherOf` and `assertPrincipalOfSchool` have existed since S0-7 and have never been
 * reached by a request until this file, so the negatives here carry more weight than usual: a
 * teacher of the school, and the class teacher of a *different* class, must both be refused.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createNotificationsModule } from '../modules/notifications/index.js';
import { createVerificationModule } from '../modules/verification/index.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { recordingPublisher } from '../shared/events/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { LeaveApplicationResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

interface LeaveList {
  data: LeaveApplicationResponse[];
}

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
/** Class teacher of class A. The parent's child is in class **B**. */
const asClassTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
/** A teacher of the school holding no class-teacher allocation at all. */
const asOtherTeacher = () => auth(fixture.otherTeacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asParent = () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT');
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'STUDENT');

const DATES = { startDate: '2026-09-14', endDate: '2026-09-16', reason: 'Family wedding.' };

/** Makes the class teacher of the child's class, so student leave has an approver. */
async function allocateClassTeacherToChildClass(): Promise<void> {
  await db.classTeacher.create({
    data: { classId: fixture.classBId, teacherId: fixture.otherTeacherProfileId },
  });
}

async function applyForChild(authorization: string, overrides: Partial<typeof DATES> = {}) {
  return request(app)
    .post(`/api/v1/children/${fixture.childId}/leave`)
    .set('Authorization', authorization)
    .send({ ...DATES, ...overrides });
}

async function applyAsTeacher(authorization: string) {
  return request(app)
    .post('/api/v1/me/leave')
    .set('Authorization', authorization)
    .send({ schoolId: fixture.schoolAccountId, ...DATES });
}

/** Applies as setup and proves it worked, so a later assertion cannot blame the wrong step. */
async function givenChildLeave(): Promise<LeaveApplicationResponse> {
  const response = await applyForChild(await asParent());
  expect(response.status, `setup: applying for leave failed — ${response.text}`).toBe(201);
  return bodyAs<LeaveApplicationResponse>(response);
}

async function givenTeacherLeave(): Promise<LeaveApplicationResponse> {
  const response = await applyAsTeacher(await asClassTeacher());
  expect(response.status, `setup: applying for leave failed — ${response.text}`).toBe(201);
  return bodyAs<LeaveApplicationResponse>(response);
}

describe('POST /children/:childId/leave — a parent applies (FR-WF-001)', () => {
  it('files the application into the child’s class queue', async () => {
    const response = await applyForChild(await asParent());

    expect(response.status).toBe(201);

    const leave = bodyAs<LeaveApplicationResponse>(response);
    expect(leave).toMatchObject({
      kind: 'STUDENT',
      status: 'RECEIVED',
      childId: fixture.childId,
      classId: fixture.classBId,
      applicantAccountId: fixture.parentAccountId,
    });
    // Calendar dates, unchanged by any timezone on the way through.
    expect(leave.startDate).toBe('2026-09-14');
    expect(leave.endDate).toBe('2026-09-16');
  });

  it('refuses a parent applying for someone else’s child', async () => {
    const stranger = await db.account.create({
      data: {
        email: `other-parent-${Date.now()}@fixture.test`,
        type: 'INDIVIDUAL',
        userProfile: {
          create: {
            fullName: 'Other parent',
            handle: `otherparent${Date.now()}`,
            role: 'PARENT',
          },
        },
      },
      select: { id: true },
    });

    const response = await applyForChild(await auth(stranger.id, 'INDIVIDUAL', 'PARENT'));

    // 404, not 403: another parent's child is not theirs to know about.
    expect(response.status).toBe(404);
    expect(await db.leaveApplication.count()).toBe(0);
  });

  it.each([
    ['a student', () => asStudent()],
    ['a teacher', () => asClassTeacher()],
    ['the school', () => asSchool()],
  ])('refuses %s — leave for a child is the parent’s to apply for', async (_l, authorization) => {
    const response = await applyForChild(await authorization());

    expect(response.status).toBe(404);
    expect(await db.leaveApplication.count()).toBe(0);
  });

  it('refuses a parent whose link to the child is no longer verified', async () => {
    await db.membership.updateMany({
      where: { accountId: fixture.parentAccountId },
      data: { status: 'REVOKED' },
    });

    const response = await applyForChild(await asParent());

    expect(response.status).toBe(403);
  });

  it('rejects a range that ends before it starts', async () => {
    const response = await applyForChild(await asParent(), {
      startDate: '2026-09-16',
      endDate: '2026-09-14',
    });

    expect(response.status).toBe(422);
  });

  it('rejects a timestamp where a calendar date belongs', async () => {
    const response = await applyForChild(await asParent(), {
      startDate: '2026-09-14T00:00:00.000Z',
    });

    expect(response.status).toBe(422);
  });

  it('accepts a single-day leave', async () => {
    const response = await applyForChild(await asParent(), {
      startDate: '2026-09-14',
      endDate: '2026-09-14',
    });

    expect(response.status).toBe(201);
  });
});

describe('POST /me/leave — a teacher applies (FR-WF-002)', () => {
  it('files the application into the school’s teacher queue', async () => {
    const response = await applyAsTeacher(await asClassTeacher());

    expect(response.status).toBe(201);
    expect(bodyAs<LeaveApplicationResponse>(response)).toMatchObject({
      kind: 'TEACHER',
      status: 'RECEIVED',
      classId: null,
      childId: null,
      applicantAccountId: fixture.teacherAccountId,
    });
  });

  it.each([
    ['a parent', () => asParent()],
    ['a student', () => asStudent()],
    ['the principal', () => asPrincipal()],
  ])('refuses %s — this endpoint is for teachers', async (_label, authorization) => {
    const response = await applyAsTeacher(await authorization());

    expect(response.status).toBe(403);
    expect(await db.leaveApplication.count()).toBe(0);
  });

  it('refuses a teacher of a different school', async () => {
    const rival = await db.account.create({
      data: {
        email: `rival-school-${Date.now()}@fixture.test`,
        type: 'SCHOOL',
        schoolProfile: { create: { name: 'Rival School' } },
      },
      select: { id: true },
    });

    const response = await request(app)
      .post('/api/v1/me/leave')
      .set('Authorization', await asClassTeacher())
      .send({ schoolId: rival.id, ...DATES });

    expect(response.status).toBe(403);
  });

  it('never takes `kind` from the client', async () => {
    const response = await request(app)
      .post('/api/v1/me/leave')
      .set('Authorization', await asClassTeacher())
      .send({ schoolId: fixture.schoolAccountId, ...DATES, kind: 'STUDENT' });

    // Sending it changes nothing: kind selects the approver, so the server decides it.
    expect(bodyAs<LeaveApplicationResponse>(response).kind).toBe('TEACHER');
  });
});

describe('POST /leave/:id/decision — student leave (FR-WF-003)', () => {
  beforeEach(allocateClassTeacherToChildClass);

  it('lets the class teacher of that class accept', async () => {
    const leave = await givenChildLeave();

    const response = await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', await asOtherTeacher())
      .send({ decision: 'ACCEPT' });

    expect(response.status).toBe(200);

    const decided = bodyAs<LeaveApplicationResponse>(response);
    expect(decided.status).toBe('ACCEPTED');
    expect(decided.decidedByAccountId).toBe(fixture.otherTeacherAccountId);
    expect(decided.decidedAt).toEqual(expect.any(String));
  });

  it('records the decision in the audit log', async () => {
    const leave = await givenChildLeave();

    await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', await asOtherTeacher())
      .send({ decision: 'REJECT', note: 'Too close to the exams.' });

    const entry = await db.auditLog.findFirst({ where: { entityId: leave.id } });
    expect(entry?.action).toBe('leave.rejected');
    expect(entry?.actorAccountId).toBe(fixture.otherTeacherAccountId);
  });

  /**
   * The rule the whole feature turns on. This teacher is the class teacher — of class A. The
   * application belongs to class B.
   */
  it('refuses the class teacher of a different class', async () => {
    const leave = await givenChildLeave();

    const response = await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', await asClassTeacher())
      .send({ decision: 'ACCEPT' });

    expect(response.status).toBe(403);
    expect(await db.leaveApplication.findUnique({ where: { id: leave.id } })).toMatchObject({
      status: 'RECEIVED',
    });
  });

  it.each([
    ['the principal', () => asPrincipal()],
    ['the school', () => asSchool()],
    ['the parent who applied', () => asParent()],
    ['a student', () => asStudent()],
  ])('refuses %s — only the class teacher decides', async (_label, authorization) => {
    const leave = await givenChildLeave();

    const response = await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', await authorization())
      .send({ decision: 'ACCEPT' });

    expect(response.status).toBe(403);
  });

  it('refuses a second decision rather than overwriting the first', async () => {
    const leave = await givenChildLeave();
    const authorization = await asOtherTeacher();

    await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', authorization)
      .send({ decision: 'ACCEPT' });

    const second = await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', authorization)
      .send({ decision: 'REJECT' });

    expect(second.status).toBe(409);
    expect(await db.leaveApplication.findUnique({ where: { id: leave.id } })).toMatchObject({
      status: 'ACCEPTED',
    });
  });
});

describe('POST /leave/:id/decision — teacher leave (FR-WF-004)', () => {
  it('lets the principal accept', async () => {
    const leave = await givenTeacherLeave();

    const response = await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', await asPrincipal())
      .send({ decision: 'ACCEPT' });

    expect(response.status).toBe(200);
    expect(bodyAs<LeaveApplicationResponse>(response).status).toBe('ACCEPTED');
  });

  it.each([
    ['the class teacher', () => asClassTeacher()],
    ['another teacher', () => asOtherTeacher()],
    ['the school', () => asSchool()],
  ])('refuses %s — teacher leave is the principal’s', async (_label, authorization) => {
    const leave = await givenTeacherLeave();

    const response = await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', await authorization())
      .send({ decision: 'ACCEPT' });

    expect(response.status).toBe(403);
  });

  it('refuses the applicant deciding their own', async () => {
    const leave = await givenTeacherLeave();

    const response = await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', await asClassTeacher())
      .send({ decision: 'ACCEPT' });

    expect(response.status).toBe(403);
  });
});

describe('the queues (FR-WF-006)', () => {
  beforeEach(allocateClassTeacherToChildClass);

  it('shows the class teacher what is waiting', async () => {
    await givenChildLeave();

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classBId}/leave?status=RECEIVED`)
      .set('Authorization', await asOtherTeacher());

    expect(response.status).toBe(200);
    expect(bodyAs<LeaveList>(response).data).toHaveLength(1);
  });

  it.each([
    ['the school', () => asSchool()],
    ['the principal', () => asPrincipal()],
  ])('gives %s read-only oversight', async (_label, authorization) => {
    const leave = await givenChildLeave();

    const list = await request(app)
      .get(`/api/v1/classes/${fixture.classBId}/leave`)
      .set('Authorization', await authorization());

    const decision = await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', await authorization())
      .send({ decision: 'ACCEPT' });

    expect(bodyAs<LeaveList>(list).data).toHaveLength(1);
    // Oversight looks. It does not decide.
    expect(decision.status).toBe(403);
  });

  it('refuses a parent reading the class queue — their child is not the only one in it', async () => {
    await givenChildLeave();

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classBId}/leave`)
      .set('Authorization', await asParent());

    expect(response.status).toBe(403);
  });

  it('refuses a teacher with no allocation to that class', async () => {
    await givenChildLeave();

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classBId}/leave`)
      .set('Authorization', await asClassTeacher());

    expect(response.status).toBe(403);
  });

  it('shows the principal the teacher queue, and refuses an outsider', async () => {
    await givenTeacherLeave();

    const principal = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/leave/teacher`)
      .set('Authorization', await asPrincipal());

    const outsider = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/leave/teacher`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<LeaveList>(principal).data).toHaveLength(1);
    expect(outsider.status).toBe(403);
  });

  it('keeps student and teacher leave in separate queues', async () => {
    await givenChildLeave();
    await givenTeacherLeave();

    const classQueue = await request(app)
      .get(`/api/v1/classes/${fixture.classBId}/leave`)
      .set('Authorization', await asOtherTeacher());
    const teacherQueue = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/leave/teacher`)
      .set('Authorization', await asPrincipal());

    expect(bodyAs<LeaveList>(classQueue).data.map((row) => row.kind)).toEqual(['STUDENT']);
    expect(bodyAs<LeaveList>(teacherQueue).data.map((row) => row.kind)).toEqual(['TEACHER']);
  });
});

describe('GET /me/leave — the applicant’s own view (FR-WF-005)', () => {
  beforeEach(allocateClassTeacherToChildClass);

  it('returns the caller’s applications and their status', async () => {
    const leave = await givenChildLeave();

    await request(app)
      .post(`/api/v1/leave/${leave.id}/decision`)
      .set('Authorization', await asOtherTeacher())
      .send({ decision: 'ACCEPT' });

    const response = await request(app)
      .get('/api/v1/me/leave')
      .set('Authorization', await asParent());

    const mine = bodyAs<LeaveList>(response).data;
    expect(mine).toHaveLength(1);
    expect(mine[0]?.status).toBe('ACCEPTED');
  });

  it('never shows another applicant’s', async () => {
    await givenChildLeave();

    const response = await request(app)
      .get('/api/v1/me/leave')
      .set('Authorization', await asOtherTeacher());

    expect(bodyAs<LeaveList>(response).data).toHaveLength(0);
  });
});

describe('notification on decision (FR-WF-005)', () => {
  beforeEach(allocateClassTeacherToChildClass);

  it('publishes a leave.decided event', async () => {
    const events = recordingPublisher();
    const { createWorkflowsModule } = await import('../modules/workflows/index.js');
    const workflows = createWorkflowsModule({ db, events, logger });

    const leave = await givenChildLeave();

    await workflows.leave.decide(
      { accountId: fixture.otherTeacherAccountId, accountType: 'INDIVIDUAL', role: 'TEACHER' },
      leave.id,
      { decision: 'ACCEPT' },
    );

    expect(events.published.map((event) => event.type)).toContain('leave.decided');
  });

  it('notifies the applicant, and nobody else', async () => {
    const verification = createVerificationModule(db, logger, recordingPublisher());
    const notifications = createNotificationsModule(db, logger, verification.service);

    await notifications.service.handleEvent({
      type: 'leave.decided',
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      leaveId: crypto.randomUUID(),
      applicantAccountId: fixture.parentAccountId,
      schoolId: fixture.schoolAccountId,
      kind: 'STUDENT',
      status: 'ACCEPTED',
    });

    const recipients = await db.notification.findMany({
      where: { type: 'leave.decided' },
      select: { recipientAccountId: true },
    });

    expect(recipients.map((row) => row.recipientAccountId)).toEqual([fixture.parentAccountId]);
  });
});
