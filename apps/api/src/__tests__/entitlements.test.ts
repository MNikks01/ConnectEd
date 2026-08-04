/**
 * Entitlement enforcement — S5-3 (`PRD/08-billing.md`, FR-BILL-003).
 *
 * The claim under test is narrower than "limits work". It is: **a limit bites at the write that
 * would exceed it, and nowhere else.** A school that is already over — because it downgraded, or
 * because the cap was lowered under it — keeps everything it has and can still read, still teach,
 * still clear its queue. Only the next addition is refused.
 *
 * That distinction is the difference between a plan limit and an outage, and it is the one a
 * future refactor is most likely to get wrong.
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
import type { ErrorEnvelope } from '@connected/types';
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

/** Rewrites the fixture school's plan limits, which is how a downgrade looks from underneath. */
async function setLimits(limits: { classes: number | null; members: number | null }) {
  const subscription = await db.subscription.findUniqueOrThrow({
    where: { schoolId: fixture.schoolAccountId },
    select: { planId: true },
  });

  // A private plan for this school alone: editing a shared catalogue row would change the limits
  // of every other school in the test database at the same time.
  const plan = await db.plan.create({
    data: {
      code: `test-${crypto.randomUUID()}`,
      name: 'Test Plan',
      limits,
      features: { advancedAnalytics: false },
    },
  });

  await db.subscription.update({
    where: { schoolId: fixture.schoolAccountId },
    data: { planId: plan.id },
  });

  return subscription;
}

const SECTIONS = ['C', 'D', 'E', 'F', 'G'] as const;

async function createClass(index: number) {
  return request(app)
    .post(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
    .set('Authorization', await asSchool())
    .send({ medium: 'ENGLISH', level: 'CLASS_9', section: SECTIONS[index] });
}

describe('the classes limit', () => {
  it('allows a class while there is room', async () => {
    await setLimits({ classes: 3, members: null });

    // The fixture has two. The third is the last one that fits.
    expect((await createClass(0)).status).toBe(201);
  });

  it('refuses the class that would exceed it', async () => {
    await setLimits({ classes: 3, members: null });
    await createClass(0);

    const response = await createClass(1);

    expect(response.status).toBe(402);
    expect(bodyAs<ErrorEnvelope>(response).error.code).toBe('PLAN_LIMIT_EXCEEDED');
  });

  it('says what the limit is, how much is used, and what lifts it', async () => {
    await setLimits({ classes: 2, members: null });

    const body = bodyAs<ErrorEnvelope>(await createClass(0));

    // Unlike a scoped 404, this refusal is meant to be read. A school that cannot tell why it was
    // stopped cannot decide to pay.
    expect(body.error.message).toContain('2 classes');
    expect(body.error.message).toContain('2 are in use');
    expect(body.error.message).toContain('Upgrading the plan');
    expect(body.error.details).toEqual([{ field: 'classes', issue: 'limit 2 reached (2 in use)' }]);
  });

  it('never refuses a school on an unlimited plan', async () => {
    await setLimits({ classes: null, members: null });

    for (let index = 0; index < 3; index += 1) {
      expect((await createClass(index)).status).toBe(201);
    }
  });

  it('leaves a school that is already over its limit alone', async () => {
    // Two classes exist; the plan now allows one. This is what a downgrade looks like.
    await setLimits({ classes: 1, members: null });

    const listed = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', await asSchool());

    // Nothing is hidden, nothing is deleted, and the school can still run the classes it has.
    expect(listed.status).toBe(200);
    expect(bodyAs<{ data: unknown[] }>(listed).data).toHaveLength(2);
    expect(await db.class.count({ where: { schoolId: fixture.schoolAccountId } })).toBe(2);
  });

  it('still lets an over-limit school rename an existing class', async () => {
    await setLimits({ classes: 1, members: null });

    const response = await request(app)
      .patch(`/api/v1/classes/${fixture.classAId}`)
      .set('Authorization', await asSchool())
      .send({ active: false });

    // The limit is on how many you may have, not on whether you may administer them.
    expect(response.status).toBe(200);
  });

  it('refuses another school’s create with 404 rather than a 402 about its plan', async () => {
    const other = await seedSchool(db);
    await setLimits({ classes: 1, members: null });

    const response = await request(app)
      .post(`/api/v1/schools/${other.schoolAccountId}/classes`)
      .set('Authorization', await asSchool())
      .send({ medium: 'ENGLISH', level: 'CLASS_9', section: 'C' });

    // Authorization runs first on purpose: a 402 here would confirm the other school exists and
    // volunteer what plan it is on.
    expect(response.status).toBe(404);
  });
});

describe('the members limit', () => {
  async function pendingRequest(): Promise<string> {
    const applicant = await db.account.create({
      data: {
        email: `applicant-${crypto.randomUUID()}@fixture.test`,
        type: 'INDIVIDUAL',
        userProfile: {
          create: {
            fullName: 'Applicant',
            handle: `applicant${Date.now()}${Math.floor(Math.random() * 1000)}`,
            role: 'USER',
          },
        },
      },
      select: { id: true },
    });

    const submitted = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', await auth(applicant.id, 'INDIVIDUAL', 'USER'))
      .send({ role: 'STUDENT', schoolId: fixture.schoolAccountId, classId: fixture.classAId });

    expect(submitted.status, `setup: submitting failed — ${submitted.text}`).toBe(201);
    return bodyAs<{ id: string }>(submitted).id;
  }

  async function decide(requestId: string, decision: 'APPROVE' | 'REJECT') {
    return request(app)
      .post(`/api/v1/verifications/${requestId}/decision`)
      .set('Authorization', await asSchool())
      .send({ decision });
  }

  it('approves while there is room', async () => {
    // The fixture has five verified memberships.
    await setLimits({ classes: null, members: 6 });

    expect((await decide(await pendingRequest(), 'APPROVE')).status).toBe(200);
  });

  it('refuses the approval that would exceed the limit', async () => {
    await setLimits({ classes: null, members: 5 });

    const response = await decide(await pendingRequest(), 'APPROVE');

    expect(response.status).toBe(402);
    expect(bodyAs<ErrorEnvelope>(response).error.details).toEqual([
      { field: 'members', issue: 'limit 5 reached (5 in use)' },
    ]);
  });

  it('leaves the request pending when the approval is refused', async () => {
    await setLimits({ classes: null, members: 5 });
    const requestId = await pendingRequest();

    await decide(requestId, 'APPROVE');

    // A half-applied decision would be the worst outcome: the school thinks it approved, the
    // applicant is not a member, and nothing is left in the queue to try again.
    const row = await db.verificationRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(row.status).toBe('PENDING');
    expect(await db.membership.count({ where: { schoolId: fixture.schoolAccountId } })).toBe(5);
  });

  it('still lets a full school reject', async () => {
    await setLimits({ classes: null, members: 5 });

    // A school that has run out of seats must still be able to clear its queue — otherwise the
    // limit turns a commercial decision into a stuck workflow.
    expect((await decide(await pendingRequest(), 'REJECT')).status).toBe(200);
  });

  it('gives the seat back when a member is removed', async () => {
    await setLimits({ classes: null, members: 5 });

    // Full: five verified members against a limit of five.
    const blocked = await decide(await pendingRequest(), 'APPROVE');
    expect(blocked.status).toBe(402);

    await request(app)
      .delete(`/api/v1/schools/${fixture.schoolAccountId}/members/${fixture.otherTeacherAccountId}`)
      .set('Authorization', await asSchool());

    // A revoked membership is history, not a seat. A school that removes a teacher and cannot
    // then admit a student would be paying for people who have left.
    expect((await decide(await pendingRequest(), 'APPROVE')).status).toBe(200);
  });

  it('does not let people waiting in the queue consume seats', async () => {
    await setLimits({ classes: null, members: 6 });
    await pendingRequest();
    await pendingRequest();
    await pendingRequest();

    // Four applicants are waiting against one free seat. Only approval consumes it — otherwise
    // anyone could exhaust a school's plan from outside simply by applying.
    expect((await decide(await pendingRequest(), 'APPROVE')).status).toBe(200);
  });

  it('does not apply to a school with no subscription at all', async () => {
    await db.subscription.deleteMany({ where: { schoolId: fixture.schoolAccountId } });

    // Resolution gives it the floor — 200 members — rather than nothing, so a missing row degrades
    // to the free tier instead of locking a real school out of its own admissions.
    expect((await decide(await pendingRequest(), 'APPROVE')).status).toBe(200);
  });
});

describe('what a limit does not touch', () => {
  it('does not stand between an individual and the social layer', async () => {
    await setLimits({ classes: 0, members: 0 });

    const response = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', await auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER'))
      .send({ body: 'Individuals are free, and the PRD says so.' });

    expect(response.status).toBe(201);
  });

  it('does not stop a verified member reading their class', async () => {
    await setLimits({ classes: 0, members: 0 });

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/subjects`)
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    // A school over its limit is a commercial matter between the school and us. It must never
    // become a student unable to see their own homework.
    expect(response.status).toBe(200);
  });
});
