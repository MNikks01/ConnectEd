/**
 * Academic content — S2-1..S2-4, S2-6 (FR-ACAD-001..006).
 *
 * This is the module the permission matrix is really about: "Publish homework" and "View homework"
 * are the rows every other capability was built to protect. The negative cases here are the
 * product working.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createNotificationsModule } from '../modules/notifications/index.js';
import { createVerificationModule } from '../modules/verification/index.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { membershipScopeKey } from '../shared/db/membership-scope.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { recordingPublisher } from '../shared/events/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { AcademicItemResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

interface ItemPage {
  data: AcademicItemResponse[];
  nextCursor: string | null;
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

/** The fixture's first teacher is allocated to Mathematics in class A. */
const asAllocatedTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
/** The second teacher is verified at the school but allocated to nothing. */
const asOtherTeacher = () => auth(fixture.otherTeacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asParent = () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT');
const asPrincipal = () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL');
const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER');

const HOMEWORK = {
  type: 'HOMEWORK',
  title: 'Chapter 4 exercises',
  body: 'Questions 1 to 10.',
};

async function publish(overrides: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/v1/classes/${fixture.classAId}/academics`)
    .set('Authorization', await asAllocatedTeacher())
    .send({ ...HOMEWORK, subjectId: fixture.mathsSubjectId, ...overrides });
}

describe('POST /classes/:id/academics — publishing (FR-ACAD-001)', () => {
  it('lets the allocated teacher publish', async () => {
    const response = await publish();

    expect(response.status).toBe(201);
    expect(bodyAs<AcademicItemResponse>(response)).toMatchObject({
      type: 'HOMEWORK',
      title: 'Chapter 4 exercises',
      classId: fixture.classAId,
      subjectName: 'Mathematics',
    });
  });

  it('refuses a teacher who is not allocated to that subject', async () => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await asOtherTeacher())
      .send({ ...HOMEWORK, subjectId: fixture.mathsSubjectId });

    expect(response.status).toBe(403);
    expect(await db.academicItem.count()).toBe(0);
  });

  it('refuses the allocated teacher on a subject they do not hold', async () => {
    // Same teacher, same class, different subject — allocation is per subject, not per class.
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await asAllocatedTeacher())
      .send({ ...HOMEWORK, subjectId: fixture.scienceSubjectId });

    expect(response.status).toBe(403);
    expect(await db.academicItem.count()).toBe(0);
  });

  it('refuses a subject that belongs to a different class', async () => {
    // Naming class B while passing class A's subject must not publish into either.
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classBId}/academics`)
      .set('Authorization', await asAllocatedTeacher())
      .send({ ...HOMEWORK, subjectId: fixture.mathsSubjectId });

    expect(response.status).toBe(404);
    expect(await db.academicItem.count()).toBe(0);
  });

  it.each([
    ['a student', () => asStudent()],
    ['a parent', () => asParent()],
    ['a principal', () => asPrincipal()],
    ['an outsider', () => asOutsider()],
  ])('refuses %s', async (_label, authorization) => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await authorization())
      .send({ ...HOMEWORK, subjectId: fixture.mathsSubjectId });

    expect(response.status).toBe(403);
    expect(await db.academicItem.count()).toBe(0);
  });

  it('allows the owning school, per the matrix', async () => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await asSchool())
      .send({ ...HOMEWORK, subjectId: fixture.mathsSubjectId });

    expect(response.status).toBe(201);
  });

  it('rejects an empty title', async () => {
    const response = await publish({ title: '   ' });

    expect(response.status).toBe(422);
  });
});

describe('GET /classes/:id/academics — the class feed (FR-ACAD-002)', () => {
  beforeEach(async () => {
    await publish();
  });

  it.each([
    ['the student of that class', () => asStudent()],
    ['the allocated teacher', () => asAllocatedTeacher()],
    ['the principal', () => asPrincipal()],
    ['the owning school', () => asSchool()],
  ])('is readable by %s', async (_label, authorization) => {
    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await authorization());

    expect(response.status).toBe(200);
    expect(bodyAs<ItemPage>(response).data).toHaveLength(1);
  });

  it('refuses an outsider with no membership', async () => {
    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(403);
  });

  it('refuses a member of a different class', async () => {
    // The parent's child is in class B, so class A's feed is not theirs.
    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await asParent());

    expect(response.status).toBe(403);
  });

  it('refuses a member whose verification was revoked', async () => {
    await db.membership.updateMany({
      where: { accountId: fixture.studentAccountId },
      data: { status: 'REVOKED' },
    });

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(403);
  });

  it('is paginated', async () => {
    await publish({ title: 'Second' });
    await publish({ title: 'Third' });

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/academics?limit=2`)
      .set('Authorization', await asStudent());

    expect(bodyAs<ItemPage>(response).data).toHaveLength(2);
    expect(bodyAs<ItemPage>(response).nextCursor).not.toBeNull();
  });
});

describe('read tracking (FR-ACAD-003)', () => {
  let itemId: string;

  beforeEach(async () => {
    itemId = bodyAs<AcademicItemResponse>(await publish()).id;
  });

  it('marks the item read when a student opens it', async () => {
    const response = await request(app)
      .get(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(200);
    expect(bodyAs<AcademicItemResponse>(response).read).toBe(true);

    const receipts = await db.readReceipt.count({ where: { subjectId: itemId } });
    expect(receipts).toBe(1);
  });

  it('is idempotent — opening twice does not double-count', async () => {
    const studentAuth = await asStudent();

    await request(app).get(`/api/v1/academics/${itemId}`).set('Authorization', studentAuth);
    await request(app).get(`/api/v1/academics/${itemId}`).set('Authorization', studentAuth);

    expect(await db.readReceipt.count({ where: { subjectId: itemId } })).toBe(1);
  });

  it('does not count the author reading their own item', async () => {
    await request(app)
      .get(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asAllocatedTeacher());

    expect(await db.readReceipt.count({ where: { subjectId: itemId } })).toBe(0);
  });

  it('shows the author a read count', async () => {
    await request(app)
      .get(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asStudent());

    const response = await request(app)
      .get(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asAllocatedTeacher());

    expect(bodyAs<AcademicItemResponse>(response).readCount).toBe(1);
  });

  it('hides the read count from a student — who has read it is not their business', async () => {
    const response = await request(app)
      .get(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asStudent());

    expect(bodyAs<AcademicItemResponse>(response).readCount).toBeUndefined();
  });

  it('reports unread state per member in the feed', async () => {
    await request(app)
      .get(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asStudent());

    const forStudent = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await asStudent());
    const forPrincipal = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await asPrincipal());

    expect(bodyAs<ItemPage>(forStudent).data[0]?.read).toBe(true);
    expect(bodyAs<ItemPage>(forPrincipal).data[0]?.read).toBe(false);
  });

  it('refuses to open an item from a class the caller is not in', async () => {
    const response = await request(app)
      .get(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(403);
    expect(await db.readReceipt.count({ where: { subjectId: itemId } })).toBe(0);
  });
});

describe('edit and delete (FR-ACAD-005)', () => {
  let itemId: string;

  beforeEach(async () => {
    itemId = bodyAs<AcademicItemResponse>(await publish()).id;
  });

  it('lets the author edit', async () => {
    const response = await request(app)
      .patch(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asAllocatedTeacher())
      .send({ title: 'Corrected title' });

    expect(response.status).toBe(200);
    expect(bodyAs<AcademicItemResponse>(response).title).toBe('Corrected title');
  });

  it('lets the owning school edit', async () => {
    const response = await request(app)
      .patch(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asSchool())
      .send({ title: 'School correction' });

    expect(response.status).toBe(200);
  });

  it.each([
    ['another teacher', () => asOtherTeacher()],
    ['the principal', () => asPrincipal()],
    ['a student', () => asStudent()],
  ])('refuses %s', async (_label, authorization) => {
    const response = await request(app)
      .patch(`/api/v1/academics/${itemId}`)
      .set('Authorization', await authorization())
      .send({ title: 'Not allowed' });

    expect(response.status).toBe(403);
    const unchanged = await db.academicItem.findUnique({ where: { id: itemId } });
    expect(unchanged?.title).toBe(HOMEWORK.title);
  });

  it('soft-deletes: gone from the feed, still in the table', async () => {
    const response = await request(app)
      .delete(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asAllocatedTeacher());

    expect(response.status).toBe(204);

    const feed = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', await asStudent());
    expect(bodyAs<ItemPage>(feed).data).toHaveLength(0);

    const row = await db.academicItem.findUnique({ where: { id: itemId } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
  });

  it('404s when reading a deleted item', async () => {
    await request(app)
      .delete(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asAllocatedTeacher());

    const response = await request(app)
      .get(`/api/v1/academics/${itemId}`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(404);
  });
});

describe('notifications on publish (FR-ACAD-004)', () => {
  it('emits academic.published after the write', async () => {
    const events = recordingPublisher();
    const { createAcademicsModule } = await import('../modules/academics/index.js');
    const academics = createAcademicsModule({ db, events, logger });

    await academics.service.publish(
      { accountId: fixture.teacherAccountId, accountType: 'INDIVIDUAL', role: 'TEACHER' },
      fixture.classAId,
      { type: 'HOMEWORK', subjectId: fixture.mathsSubjectId, title: 'T', body: 'B' },
    );

    expect(events.published.map((event) => event.type)).toContain('academic.published');
  });

  it('fans out to every verified member of the class except the author', async () => {
    const verification = createVerificationModule(db, logger, recordingPublisher());
    const notifications = createNotificationsModule(db, logger, verification.service);

    await notifications.service.handleEvent({
      type: 'academic.published',
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      itemId: crypto.randomUUID(),
      classId: fixture.classAId,
      itemType: 'HOMEWORK',
      title: 'Chapter 4',
      authorAccountId: fixture.teacherAccountId,
    });

    const recipients = await db.notification.findMany({ select: { recipientAccountId: true } });
    const ids = recipients.map((row) => row.recipientAccountId);

    // The student of class A, the principal, and the other teacher — not the author, and not the
    // parent, whose child is in class B.
    expect(ids).toContain(fixture.studentAccountId);
    expect(ids).toContain(fixture.principalAccountId);
    expect(ids).not.toContain(fixture.teacherAccountId);
    expect(ids).not.toContain(fixture.parentAccountId);
  });

  it('is idempotent across a redelivered event', async () => {
    const verification = createVerificationModule(db, logger, recordingPublisher());
    const notifications = createNotificationsModule(db, logger, verification.service);

    const event = {
      type: 'academic.published' as const,
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      itemId: crypto.randomUUID(),
      classId: fixture.classAId,
      itemType: 'HOMEWORK',
      title: 'Chapter 4',
      authorAccountId: fixture.teacherAccountId,
    };

    await notifications.service.handleEvent(event);
    const afterFirst = await db.notification.count();
    await notifications.service.handleEvent(event);

    // Every row shares one event id — this only works because the constraint is per recipient.
    expect(await db.notification.count()).toBe(afterFirst);
    expect(afterFirst).toBeGreaterThan(1);
  });
});

describe('the role a real account actually carries', () => {
  /**
   * The regression this file was missing. Every other case here signs a token with `role:
   * 'TEACHER'`, but `POST /auth/register` creates individuals as `USER` (FR-AUTH-001) and nothing
   * promotes them — so an account built the way a person's is could not publish, while the suite
   * stayed green. The membership row is the authority, exactly as the permission matrix says.
   */
  it('lets an approved teacher whose profile role is still USER publish', async () => {
    const account = await db.account.create({
      data: {
        email: `real-teacher-${Date.now()}@fixture.test`,
        type: 'INDIVIDUAL',
        userProfile: {
          create: {
            fullName: 'Newly approved teacher',
            handle: `realteacher${Date.now()}`,
            // What registration gives everyone.
            role: 'USER',
          },
        },
      },
      select: { id: true },
    });

    const teacherProfile = await db.teacherProfile.create({
      data: { accountId: account.id, schoolId: fixture.schoolAccountId },
      select: { id: true },
    });
    await db.subjectAllocation.create({
      data: { teacherId: teacherProfile.id, subjectId: fixture.mathsSubjectId },
    });
    await db.membership.create({
      data: {
        accountId: account.id,
        schoolId: fixture.schoolAccountId,
        role: 'TEACHER',
        scopeKey: membershipScopeKey(null, null),
        status: 'VERIFIED',
      },
    });

    // Signed with the claim the auth module would actually issue for this account.
    const token = await tokens.signAccessToken({
      sub: account.id,
      accountType: 'INDIVIDUAL',
      role: 'USER',
    });

    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'HOMEWORK',
        subjectId: fixture.mathsSubjectId,
        title: 'Published without a TEACHER claim',
        body: 'The membership is what grants this.',
      });

    expect(response.status).toBe(201);
  });

  it('still refuses an account with a TEACHER claim but no membership', async () => {
    const impostor = await db.account.create({
      data: {
        email: `impostor-${Date.now()}@fixture.test`,
        type: 'INDIVIDUAL',
        userProfile: {
          create: {
            fullName: 'Claims to teach',
            handle: `impostor${Date.now()}`,
            role: 'TEACHER',
          },
        },
      },
      select: { id: true },
    });

    const token = await tokens.signAccessToken({
      sub: impostor.id,
      accountType: 'INDIVIDUAL',
      role: 'TEACHER',
    });

    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/academics`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'HOMEWORK',
        subjectId: fixture.mathsSubjectId,
        title: 'Should not appear',
        body: 'No allocation, no membership.',
      });

    expect(response.status).toBe(403);
  });
});
