/**
 * Complaints and suggestions — S3-7 (FR-WF-010, 011, 012).
 *
 * Three audiences that do not coincide, which is what makes this worth testing carefully: parents
 * and staff submit, staff read the queue, and only the school or its principal reviews. A parent
 * can follow what they raised and nothing else — a complaint one parent made is not another's to
 * read, and the matrix says so by giving Parent no `👁` on "Review complaints".
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
import type { FeedbackResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

interface FeedbackList {
  data: FeedbackResponse[];
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
const asTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asParent = () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT');
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'STUDENT');

async function submit(authorization: string, kind: 'COMPLAINT' | 'SUGGESTION' = 'COMPLAINT') {
  return request(app)
    .post(`/api/v1/schools/${fixture.schoolAccountId}/feedback`)
    .set('Authorization', authorization)
    .send({ kind, body: 'The bus has been late every day this week.' });
}

/** Submits as setup and proves it worked, so a later assertion cannot blame the wrong step. */
async function givenFeedback(authorization: string): Promise<FeedbackResponse> {
  const response = await submit(authorization);
  expect(response.status, `setup: submitting feedback failed — ${response.text}`).toBe(201);
  return bodyAs<FeedbackResponse>(response);
}

describe('POST /schools/:id/feedback — submitting (FR-WF-010)', () => {
  it.each([
    ['a parent', () => asParent()],
    ['a teacher', () => asTeacher()],
    ['the principal', () => asPrincipal()],
  ])('lets %s raise a complaint', async (_label, authorization) => {
    const response = await submit(await authorization());

    expect(response.status).toBe(201);

    const feedback = bodyAs<FeedbackResponse>(response);
    expect(feedback.status).toBe('OPEN');
    // Not an anonymous channel, and the response says so plainly.
    expect(feedback.authorName).toBeTruthy();
  });

  it('records a suggestion as a suggestion', async () => {
    const response = await submit(await asParent(), 'SUGGESTION');

    expect(bodyAs<FeedbackResponse>(response).kind).toBe('SUGGESTION');
  });

  it('refuses a student — the module is hidden from them', async () => {
    const response = await submit(await asStudent());

    expect(response.status).toBe(403);
    expect(await db.feedback.count()).toBe(0);
  });

  it('refuses the school — it would be complaining to itself', async () => {
    const response = await submit(await asSchool());

    expect(response.status).toBe(403);
    expect(await db.feedback.count()).toBe(0);
  });

  it('refuses someone with no verified membership at the school', async () => {
    const response = await submit(await asOutsider());

    expect(response.status).toBe(403);
  });

  it('refuses a parent whose membership has been revoked', async () => {
    await db.membership.updateMany({
      where: { accountId: fixture.parentAccountId },
      data: { status: 'REVOKED' },
    });

    const response = await submit(await asParent());

    expect(response.status).toBe(403);
  });

  it('rejects an empty body before it reaches the database', async () => {
    const response = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/feedback`)
      .set('Authorization', await asParent())
      .send({ kind: 'COMPLAINT', body: '   ' });

    expect(response.status).toBe(422);
  });
});

describe('GET /schools/:id/feedback — the queue (FR-WF-011)', () => {
  it.each([
    ['the school', () => asSchool()],
    ['the principal', () => asPrincipal()],
    ['a teacher', () => asTeacher()],
  ])('lets %s read it', async (_label, authorization) => {
    await givenFeedback(await asParent());

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/feedback`)
      .set('Authorization', await authorization());

    expect(response.status).toBe(200);
    expect(bodyAs<FeedbackList>(response).data).toHaveLength(1);
  });

  /** The one that matters: a complaint is not readable by the community it is about. */
  it('refuses a parent — including the one who raised it', async () => {
    await givenFeedback(await asParent());

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/feedback`)
      .set('Authorization', await asParent());

    expect(response.status).toBe(403);
  });

  it('refuses a student and an outsider', async () => {
    await givenFeedback(await asParent());

    const student = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/feedback`)
      .set('Authorization', await asStudent());
    const outsider = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/feedback`)
      .set('Authorization', await asOutsider());

    expect(student.status).toBe(403);
    expect(outsider.status).toBe(403);
  });

  it('filters by status', async () => {
    const open = await givenFeedback(await asParent());
    await givenFeedback(await asTeacher());

    await request(app)
      .post(`/api/v1/feedback/${open.id}/review`)
      .set('Authorization', await asSchool())
      .send({ status: 'RESOLVED' });

    const resolved = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/feedback?status=RESOLVED`)
      .set('Authorization', await asSchool());

    expect(bodyAs<FeedbackList>(resolved).data).toHaveLength(1);
    expect(bodyAs<FeedbackList>(resolved).data[0]?.id).toBe(open.id);
  });
});

describe('POST /feedback/:id/review — reviewing (FR-WF-011)', () => {
  it.each([
    ['the school', () => asSchool()],
    ['the principal', () => asPrincipal()],
  ])('lets %s move it forward', async (_label, authorization) => {
    const feedback = await givenFeedback(await asParent());

    const response = await request(app)
      .post(`/api/v1/feedback/${feedback.id}/review`)
      .set('Authorization', await authorization())
      .send({ status: 'UNDER_REVIEW' });

    expect(response.status).toBe(200);

    const reviewed = bodyAs<FeedbackResponse>(response);
    expect(reviewed.status).toBe('UNDER_REVIEW');
    expect(reviewed.reviewedByAccountId).toBeTruthy();
    expect(reviewed.reviewedAt).toEqual(expect.any(String));
  });

  it('refuses a teacher — they watch the queue, they do not decide it', async () => {
    const feedback = await givenFeedback(await asParent());

    const response = await request(app)
      .post(`/api/v1/feedback/${feedback.id}/review`)
      .set('Authorization', await asTeacher())
      .send({ status: 'RESOLVED' });

    expect(response.status).toBe(403);
    expect(await db.feedback.findUnique({ where: { id: feedback.id } })).toMatchObject({
      status: 'OPEN',
    });
  });

  it('refuses the author reviewing their own', async () => {
    const feedback = await givenFeedback(await asParent());

    const response = await request(app)
      .post(`/api/v1/feedback/${feedback.id}/review`)
      .set('Authorization', await asParent())
      .send({ status: 'RESOLVED' });

    expect(response.status).toBe(403);
  });

  it('refuses another school with 404', async () => {
    const feedback = await givenFeedback(await asParent());

    const rival = await db.account.create({
      data: {
        email: `rival-fb-${Date.now()}@fixture.test`,
        type: 'SCHOOL',
        schoolProfile: { create: { name: 'Rival School' } },
      },
      select: { id: true },
    });

    const response = await request(app)
      .post(`/api/v1/feedback/${feedback.id}/review`)
      .set('Authorization', await auth(rival.id, 'SCHOOL'))
      .send({ status: 'RESOLVED' });

    expect(response.status).toBe(404);
  });

  it('will not move it back to unread', async () => {
    const feedback = await givenFeedback(await asParent());

    const response = await request(app)
      .post(`/api/v1/feedback/${feedback.id}/review`)
      .set('Authorization', await asSchool())
      .send({ status: 'OPEN' });

    expect(response.status).toBe(422);
  });

  it('records the review in the audit log', async () => {
    const feedback = await givenFeedback(await asParent());

    await request(app)
      .post(`/api/v1/feedback/${feedback.id}/review`)
      .set('Authorization', await asSchool())
      .send({ status: 'RESOLVED' });

    const entry = await db.auditLog.findFirst({ where: { entityId: feedback.id } });
    expect(entry?.action).toBe('feedback.resolved');
    expect(entry?.actorAccountId).toBe(fixture.schoolAccountId);
  });
});

describe('GET /me/feedback — following what you raised', () => {
  it('returns the caller’s own, with its current status', async () => {
    const feedback = await givenFeedback(await asParent());

    await request(app)
      .post(`/api/v1/feedback/${feedback.id}/review`)
      .set('Authorization', await asSchool())
      .send({ status: 'RESOLVED' });

    const response = await request(app)
      .get('/api/v1/me/feedback')
      .set('Authorization', await asParent());

    const mine = bodyAs<FeedbackList>(response).data;
    expect(mine).toHaveLength(1);
    expect(mine[0]?.status).toBe('RESOLVED');
  });

  it('never shows another author’s', async () => {
    await givenFeedback(await asParent());

    const response = await request(app)
      .get('/api/v1/me/feedback')
      .set('Authorization', await asTeacher());

    expect(bodyAs<FeedbackList>(response).data).toHaveLength(0);
  });
});

describe('notification on review (FR-WF-012)', () => {
  it('publishes a feedback.reviewed event', async () => {
    const events = recordingPublisher();
    const { createWorkflowsModule } = await import('../modules/workflows/index.js');
    const workflows = createWorkflowsModule({ db, events, logger });

    const feedback = await givenFeedback(await asParent());

    await workflows.feedback.review(
      { accountId: fixture.schoolAccountId, accountType: 'SCHOOL' },
      feedback.id,
      { status: 'RESOLVED' },
    );

    expect(events.published.map((event) => event.type)).toContain('feedback.reviewed');
  });

  it('notifies the author, and nobody else', async () => {
    const verification = createVerificationModule(db, logger, recordingPublisher());
    const notifications = createNotificationsModule(db, logger, verification.service);

    await notifications.service.handleEvent({
      type: 'feedback.reviewed',
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      feedbackId: crypto.randomUUID(),
      authorAccountId: fixture.parentAccountId,
      schoolId: fixture.schoolAccountId,
      status: 'RESOLVED',
    });

    const recipients = await db.notification.findMany({
      where: { type: 'feedback.reviewed' },
      select: { recipientAccountId: true },
    });

    expect(recipients.map((row) => row.recipientAccountId)).toEqual([fixture.parentAccountId]);
  });
});
