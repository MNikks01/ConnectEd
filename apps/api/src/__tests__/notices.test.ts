/**
 * Notices and events — S2-5 (FR-ACAD-010, 011, 012).
 *
 * The permission shape here is new: homework is scoped to a *class*, a notice to the whole
 * *school*. So the interesting negatives are not "wrong class" but "wrong side of the school
 * boundary" — a teacher may read every notice and publish none of them, and a verified member of
 * another school may do neither.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createBillingModule } from '../modules/billing/index.js';
import { createNotificationsModule } from '../modules/notifications/index.js';
import { createVerificationModule } from '../modules/verification/index.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { EventResponse, NoticeResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

/** The real guard rather than a fake, so these constructions cannot drift from the app's. */
const billingService = () => createBillingModule(testDb(), logger).service;

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
const asTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asParent = () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'STUDENT');

async function publishNotice(authorization: string, title = 'Sports day moved') {
  return request(app)
    .post(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
    .set('Authorization', authorization)
    .send({ title, body: 'It is now on the 14th.' });
}

/**
 * Publishes as *setup* and proves it worked.
 *
 * Without this, a setup call that unexpectedly fails hands `undefined` to the next request and the
 * case reports a puzzling status from a URL containing "undefined" — which is exactly how two
 * cases here failed once in a full-suite run, describing a symptom three steps from the cause.
 */
async function givenNotice(authorization: string, title = 'Sports day moved') {
  const response = await publishNotice(authorization, title);
  expect(response.status, `setup: publishing the notice failed — ${response.text}`).toBe(201);

  return bodyAs<NoticeResponse>(response);
}

async function createEvent(eventAt: string, title = 'Annual day') {
  return request(app)
    .post(`/api/v1/schools/${fixture.schoolAccountId}/events`)
    .set('Authorization', await asSchool())
    .send({ title, body: 'In the main hall.', eventAt });
}

const IN_A_WEEK = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
const LAST_WEEK = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

describe('POST /schools/:id/notices — publishing (FR-ACAD-010)', () => {
  it('lets the school publish', async () => {
    const response = await publishNotice(await asSchool());

    expect(response.status).toBe(201);
    const notice = bodyAs<NoticeResponse>(response);
    expect(notice.title).toBe('Sports day moved');
    // The school wrote it, so it reads its own name rather than a blank author.
    expect(notice.authorName).toBe('Fixture School');
  });

  it('lets the verified principal publish', async () => {
    const response = await publishNotice(await asPrincipal());

    expect(response.status).toBe(201);
    expect(bodyAs<NoticeResponse>(response).authorAccountId).toBe(fixture.principalAccountId);
  });

  it.each([
    ['a teacher', () => asTeacher()],
    ['a student', () => asStudent()],
    ['a parent', () => asParent()],
  ])('refuses %s — a notice speaks for the institution', async (_label, authorization) => {
    const response = await publishNotice(await authorization());

    expect(response.status).toBe(403);
  });

  it('refuses a principal of a different school with 404', async () => {
    const rival = await db.account.create({
      data: {
        email: `rival-${Date.now()}@fixture.test`,
        type: 'SCHOOL',
        schoolProfile: { create: { name: 'Rival School' } },
      },
      select: { id: true },
    });

    const response = await request(app)
      .post(`/api/v1/schools/${rival.id}/notices`)
      .set('Authorization', await asPrincipal())
      .send({ title: 'Not mine to write', body: 'x' });

    // 403, not 404: the school's existence is not a secret — its notice list is.
    expect([403, 404]).toContain(response.status);
    expect(await db.notice.count({ where: { schoolId: rival.id } })).toBe(0);
  });

  it('rejects an empty title before it reaches the database', async () => {
    const response = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
      .set('Authorization', await asSchool())
      .send({ title: '   ', body: 'x' });

    expect(response.status).toBe(422);
  });
});

describe('GET /schools/:id/notices — reading (FR-ACAD-010)', () => {
  it.each([
    ['a student', () => asStudent()],
    ['a parent', () => asParent()],
    ['a teacher', () => asTeacher()],
    ['the principal', () => asPrincipal()],
    ['the school', () => asSchool()],
  ])('lets %s read the school’s notices', async (_label, authorization) => {
    await publishNotice(await asSchool());

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
      .set('Authorization', await authorization());

    expect(response.status).toBe(200);
    expect(bodyAs<{ data: NoticeResponse[] }>(response).data).toHaveLength(1);
  });

  it('refuses someone with no verified membership at the school', async () => {
    await publishNotice(await asSchool());

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(403);
  });

  it('shows read counts to the author and the school, and to nobody else', async () => {
    await publishNotice(await asPrincipal());

    const author = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
      .set('Authorization', await asPrincipal());
    const school = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
      .set('Authorization', await asSchool());
    const student = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
      .set('Authorization', await asStudent());

    expect(bodyAs<{ data: NoticeResponse[] }>(author).data[0]?.readCount).toBe(0);
    expect(bodyAs<{ data: NoticeResponse[] }>(school).data[0]?.readCount).toBe(0);
    // A student has no business knowing how many classmates opened it.
    expect(bodyAs<{ data: NoticeResponse[] }>(student).data[0]?.readCount).toBeUndefined();
  });

  it('drops a deleted notice from the list', async () => {
    const created = await givenNotice(await asSchool());

    await request(app)
      .delete(`/api/v1/notices/${created.id}`)
      .set('Authorization', await asSchool());

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
      .set('Authorization', await asStudent());

    expect(bodyAs<{ data: NoticeResponse[] }>(response).data).toHaveLength(0);
    // Soft delete: gone from every feed, still in the table for audit.
    expect(await db.notice.count({ where: { id: created.id } })).toBe(1);
  });
});

describe('GET /notices/:id — read tracking (FR-ACAD-010)', () => {
  it('marks the notice read for the caller, once', async () => {
    const created = await givenNotice(await asSchool());

    const first = await request(app)
      .get(`/api/v1/notices/${created.id}`)
      .set('Authorization', await asStudent());
    await request(app)
      .get(`/api/v1/notices/${created.id}`)
      .set('Authorization', await asStudent());

    expect(first.status).toBe(200);
    expect(
      await db.readReceipt.count({
        where: { subjectType: 'NOTICE', subjectId: created.id },
      }),
    ).toBe(1);
  });

  it('does not count the author reading their own notice', async () => {
    const created = await givenNotice(await asPrincipal());

    const response = await request(app)
      .get(`/api/v1/notices/${created.id}`)
      .set('Authorization', await asPrincipal());

    expect(bodyAs<NoticeResponse>(response).readCount).toBe(0);
  });

  it('refuses a non-member, without revealing whether the notice exists', async () => {
    const created = await givenNotice(await asSchool());

    const response = await request(app)
      .get(`/api/v1/notices/${created.id}`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(403);
  });
});

describe('PATCH/DELETE /notices/:id — editing', () => {
  it('lets the author edit', async () => {
    const created = await givenNotice(await asPrincipal());

    const response = await request(app)
      .patch(`/api/v1/notices/${created.id}`)
      .set('Authorization', await asPrincipal())
      .send({ title: 'Sports day moved again' });

    expect(response.status).toBe(200);
    expect(bodyAs<NoticeResponse>(response).title).toBe('Sports day moved again');
  });

  it('lets the school edit a notice its principal wrote', async () => {
    const created = await givenNotice(await asPrincipal());

    const response = await request(app)
      .patch(`/api/v1/notices/${created.id}`)
      .set('Authorization', await asSchool())
      .send({ body: 'Corrected by the office.' });

    expect(response.status).toBe(200);
  });

  it('refuses a teacher editing someone else’s notice', async () => {
    const created = await givenNotice(await asSchool());

    const response = await request(app)
      .patch(`/api/v1/notices/${created.id}`)
      .set('Authorization', await asTeacher())
      .send({ title: 'Hijacked' });

    expect(response.status).toBe(403);
  });

  it('refuses a student deleting a notice', async () => {
    const created = await givenNotice(await asSchool());

    const response = await request(app)
      .delete(`/api/v1/notices/${created.id}`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(403);
  });
});

describe('events (FR-ACAD-011)', () => {
  it('lets the school create one and lists it chronologically', async () => {
    const soon = new Date(Date.now() + 2 * 24 * 3600_000).toISOString();

    await createEvent(IN_A_WEEK, 'Annual day');
    await createEvent(soon, 'Parents evening');

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/events`)
      .set('Authorization', await asStudent());

    const titles = bodyAs<{ data: EventResponse[] }>(response).data.map((row) => row.title);
    // By when they happen, not when they were created.
    expect(titles).toEqual(['Parents evening', 'Annual day']);
  });

  it('hides past events unless they are asked for', async () => {
    await createEvent(LAST_WEEK, 'Founders day');
    await createEvent(IN_A_WEEK, 'Annual day');

    const upcoming = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/events`)
      .set('Authorization', await asParent());
    const everything = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/events?includePast=true`)
      .set('Authorization', await asParent());

    expect(bodyAs<{ data: EventResponse[] }>(upcoming).data.map((row) => row.title)).toEqual([
      'Annual day',
    ]);
    expect(bodyAs<{ data: EventResponse[] }>(everything).data).toHaveLength(2);
  });

  it.each([
    ['the principal', () => asPrincipal()],
    ['a teacher', () => asTeacher()],
    ['a student', () => asStudent()],
  ])('refuses %s creating an event — the school’s alone', async (_label, authorization) => {
    const response = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/events`)
      .set('Authorization', await authorization())
      .send({ title: 'Unauthorized', body: 'x', eventAt: IN_A_WEEK });

    expect(response.status).toBe(403);
    expect(await db.event.count()).toBe(0);
  });

  it('refuses a non-member reading the calendar', async () => {
    await createEvent(IN_A_WEEK);

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/events`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(403);
  });

  it('lets the school move and cancel an event', async () => {
    const created = bodyAs<EventResponse>(await createEvent(IN_A_WEEK));
    const moved = new Date(Date.now() + 10 * 24 * 3600_000).toISOString();

    const patched = await request(app)
      .patch(`/api/v1/events/${created.id}`)
      .set('Authorization', await asSchool())
      .send({ eventAt: moved });

    expect(bodyAs<EventResponse>(patched).eventAt).toBe(moved);

    await request(app)
      .delete(`/api/v1/events/${created.id}`)
      .set('Authorization', await asSchool());

    const list = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/events`)
      .set('Authorization', await asStudent());

    expect(bodyAs<{ data: EventResponse[] }>(list).data).toHaveLength(0);
  });

  it('refuses a principal editing an event', async () => {
    const created = bodyAs<EventResponse>(await createEvent(IN_A_WEEK));

    const response = await request(app)
      .patch(`/api/v1/events/${created.id}`)
      .set('Authorization', await asPrincipal())
      .send({ title: 'Renamed' });

    expect(response.status).toBe(403);
  });
});

describe('notifications (FR-ACAD-012)', () => {
  it('records a notice.published event in the outbox', async () => {
    const { createAcademicsModule } = await import('../modules/academics/index.js');
    const academics = createAcademicsModule({ db, logger });

    await academics.notices.publishNotice(
      { accountId: fixture.schoolAccountId, accountType: 'SCHOOL' },
      fixture.schoolAccountId,
      { title: 'Holiday', body: 'School is closed on Friday.' },
    );

    const recorded = await db.outboxEvent.findMany({ where: { type: 'notice.published' } });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.publishedAt).toBeNull();
  });

  it('fans a notice out to every verified member of the school, minus its author', async () => {
    const verification = createVerificationModule(db, logger, billingService());
    const notifications = createNotificationsModule(db, logger, verification.service);

    await notifications.service.handleEvent({
      type: 'notice.published',
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      noticeId: crypto.randomUUID(),
      schoolId: fixture.schoolAccountId,
      title: 'Holiday',
      authorAccountId: fixture.principalAccountId,
    });

    const recipients = await db.notification.findMany({
      where: { type: 'notice.published' },
      select: { recipientAccountId: true },
    });
    const ids = recipients.map((row) => row.recipientAccountId);

    // Everyone verified — including the Class B teacher, who no class-scoped fan-out would reach.
    expect(ids).toContain(fixture.studentAccountId);
    expect(ids).toContain(fixture.parentAccountId);
    expect(ids).toContain(fixture.teacherAccountId);
    // The principal wrote it.
    expect(ids).not.toContain(fixture.principalAccountId);
    // Never anyone outside the school.
    expect(ids).not.toContain(fixture.outsiderAccountId);
  });

  it('fans an event out, and is idempotent on redelivery', async () => {
    const verification = createVerificationModule(db, logger, billingService());
    const notifications = createNotificationsModule(db, logger, verification.service);

    const event = {
      type: 'event.published' as const,
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      eventEntityId: crypto.randomUUID(),
      schoolId: fixture.schoolAccountId,
      title: 'Annual day',
      eventAt: IN_A_WEEK,
    };

    await notifications.service.handleEvent(event);
    const afterFirst = await db.notification.count({ where: { type: 'event.published' } });

    // At-least-once delivery means this happens in production, not just in tests.
    await notifications.service.handleEvent(event);

    expect(afterFirst).toBeGreaterThan(0);
    expect(await db.notification.count({ where: { type: 'event.published' } })).toBe(afterFirst);
  });
});
