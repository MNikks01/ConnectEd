/**
 * Plans, trials, and entitlement resolution — S5-1, S5-2 (`PRD/08-billing.md`, FR-BILL-001).
 *
 * Two claims are worth more than the rest here:
 *
 * 1. **A school cannot exist without a subscription.** The registration test asserts it through
 *    the public API, not by inspecting the repository — because the thing that could break it is
 *    someone "simplifying" the nested create back into two writes.
 * 2. **Cancelling is not deleting.** A school over its limit after a downgrade keeps its classes.
 *    That is the failure mode that would be discovered in production by a school losing access to
 *    its own timetable, so it is asserted before any enforcement exists to get it wrong.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createBillingModule } from '../modules/billing/index.js';
import { PLAN_CATALOGUE, TRIAL_DAYS, TRIAL_PLAN_CODE } from '../modules/billing/plan-catalogue.js';
import { createLogger } from '../shared/logger/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { SubscriptionResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

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

const billing = () => createBillingModule(testDb(), logger).service;

const uniqueEmail = () => `school-${crypto.randomUUID()}@registration.test`;

describe('the plan catalogue', () => {
  it('is present without anyone having seeded it', async () => {
    // `resetDb` truncates every table; the catalogue is reapplied from code, so this asserts the
    // invariant the whole module leans on rather than a fixture someone remembered to write.
    const codes = (await db.plan.findMany({ select: { code: true } })).map((row) => row.code);

    expect(codes.sort()).toEqual(PLAN_CATALOGUE.map((plan) => plan.code).sort());
  });

  it('is idempotent, so a second boot changes nothing', async () => {
    await billing().ensureCatalogue();
    await billing().ensureCatalogue();

    expect(await db.plan.count()).toBe(PLAN_CATALOGUE.length);
  });

  it('brings a hand-edited plan back to the catalogue', async () => {
    await db.plan.update({ where: { code: TRIAL_PLAN_CODE }, data: { limits: { classes: 9999 } } });

    await billing().ensureCatalogue();

    const trial = await db.plan.findUniqueOrThrow({ where: { code: TRIAL_PLAN_CODE } });
    // The table follows the code. An edit in production survives exactly until the next deploy,
    // which is the property that makes the catalogue reviewable in a pull request.
    expect(trial.limits).toMatchObject({ classes: 5 });
  });
});

describe('registration starts a trial (FR-BILL-001)', () => {
  it('gives a newly registered school a trial in the same breath', async () => {
    const email = uniqueEmail();
    const response = await request(app)
      .post('/api/v1/auth/register/school')
      .send({ email, password: 'Str0ng!Passw0rd', name: 'Trial Test School' });

    expect(response.status).toBe(201);

    // Registration answers with a session, not an account, so the school is found by the address
    // it registered with — which is also the only handle a real caller would have.
    const account = await db.account.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const subscription = await db.subscription.findUnique({
      where: { schoolId: account.id },
      select: { status: true, periodEnd: true, plan: { select: { code: true } } },
    });

    expect(subscription).not.toBeNull();
    expect(subscription?.status).toBe('TRIALING');
    expect(subscription?.plan.code).toBe(TRIAL_PLAN_CODE);
  });

  it('ends the trial TRIAL_DAYS after it starts', async () => {
    const email = uniqueEmail();
    await request(app)
      .post('/api/v1/auth/register/school')
      .send({ email, password: 'Str0ng!Passw0rd', name: 'Countdown School' });

    const account = await db.account.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const subscription = await db.subscription.findUniqueOrThrow({
      where: { schoolId: account.id },
    });

    const days =
      (subscription.periodEnd.getTime() - subscription.periodStart.getTime()) /
      (24 * 60 * 60 * 1000);

    expect(Math.round(days)).toBe(TRIAL_DAYS);
  });

  it('leaves no school behind when the whole write fails', async () => {
    const email = uniqueEmail();
    await request(app)
      .post('/api/v1/auth/register/school')
      .send({ email, password: 'Str0ng!Passw0rd', name: 'First' });

    // The second registration collides on email and must roll back entirely — the interesting
    // failure is a duplicate school that got a subscription anyway, or a subscription orphaned by
    // an account that was never created.
    const duplicate = await request(app)
      .post('/api/v1/auth/register/school')
      .send({ email, password: 'Str0ng!Passw0rd', name: 'Second' });

    expect(duplicate.status).toBe(409);
    expect(await db.account.count({ where: { email } })).toBe(1);
    expect(await db.subscription.count()).toBe(2); // the fixture school, plus the first registration
  });

  it('does not give an individual a subscription', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `person-${crypto.randomUUID()}@registration.test`,
        password: 'Str0ng!Passw0rd',
        fullName: 'A Person',
        handle: `person${Date.now()}`,
      });

    // Individuals are free, and the PRD says so. A subscription row for one would be the first
    // step towards charging them.
    expect(await db.subscription.count()).toBe(1);
  });
});

describe('GET /schools/:id/subscription', () => {
  it('shows the school its plan, its limits, and its usage against them', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/subscription`)
      .set('Authorization', await asSchool());

    const body = bodyAs<SubscriptionResponse>(response);

    expect(body.status).toBe('TRIALING');
    expect(body.planCode).toBe(TRIAL_PLAN_CODE);
    expect(body.limits).toEqual({ classes: 5, members: 200 });
    // The fixture: two classes, five verified memberships. A limit without the usage beside it
    // tells a school nothing.
    expect(body.usage).toEqual({ classes: 2, members: 5 });
  });

  it('counts only verified members towards the limit', async () => {
    await db.membership.updateMany({
      where: { accountId: fixture.studentAccountId },
      data: { status: 'PENDING' },
    });

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/subscription`)
      .set('Authorization', await asSchool());

    // Otherwise a stranger could push a school over its plan limit simply by applying to join it.
    expect(bodyAs<SubscriptionResponse>(response).usage.members).toBe(4);
  });

  it('refuses the school’s own principal', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/subscription`)
      .set('Authorization', await asPrincipal());

    // The matrix gives `Manage subscription/billing` to the school account and nobody else — not
    // even the principal, who can approve leave but does not hold the contract.
    expect(response.status).toBe(403);
  });

  it('404s for another school rather than admitting it exists', async () => {
    const other = await seedSchool(db);

    const response = await request(app)
      .get(`/api/v1/schools/${other.schoolAccountId}/subscription`)
      .set('Authorization', await asSchool());

    expect(response.status).toBe(404);
  });

  it('refuses an unauthenticated caller', async () => {
    const response = await request(app).get(
      `/api/v1/schools/${fixture.schoolAccountId}/subscription`,
    );

    expect(response.status).toBe(401);
  });
});

describe('entitlement resolution', () => {
  async function putOnPlan(code: string, status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED') {
    const plan = await db.plan.findUniqueOrThrow({ where: { code } });
    await db.subscription.update({
      where: { schoolId: fixture.schoolAccountId },
      data: { planId: plan.id, status },
    });
  }

  it('gives an active school its plan', async () => {
    await putOnPlan('premium', 'ACTIVE');

    const entitlements = await billing().entitlementsFor(fixture.schoolAccountId);

    expect(entitlements.limits).toEqual({ classes: null, members: null });
    expect(entitlements.features.advancedAnalytics).toBe(true);
  });

  it('keeps a past-due school on its plan', async () => {
    await putOnPlan('premium', 'PAST_DUE');

    const entitlements = await billing().entitlementsFor(fixture.schoolAccountId);

    // A bounced renewal is usually an expired card. Cutting the school off the same morning would
    // punish the students, not the payer; dunning (S5-6) decides when the grace period ends.
    expect(entitlements.limits.classes).toBeNull();
    expect(entitlements.status).toBe('PAST_DUE');
  });

  it('drops a cancelled school to the floor without touching its data', async () => {
    await putOnPlan('premium', 'CANCELED');

    const entitlements = await billing().entitlementsFor(fixture.schoolAccountId);

    expect(entitlements.limits).toEqual({ classes: 5, members: 200 });
    expect(entitlements.features.advancedAnalytics).toBe(false);
    // The point of the test: the classes are still there. Cancelling is not deleting, and a school
    // above the floor keeps what it has rather than losing it.
    expect(await db.class.count({ where: { schoolId: fixture.schoolAccountId } })).toBe(2);
  });

  it('falls back to the floor when a school has no subscription at all', async () => {
    await db.subscription.deleteMany({ where: { schoolId: fixture.schoolAccountId } });

    const entitlements = await billing().entitlementsFor(fixture.schoolAccountId);

    expect(entitlements.status).toBeNull();
    expect(entitlements.limits).toEqual({ classes: 5, members: 200 });
  });

  it('falls back to the floor when a plan row does not match the catalogue', async () => {
    const plan = await db.plan.findUniqueOrThrow({ where: { code: 'premium' } });
    await db.subscription.update({
      where: { schoolId: fixture.schoolAccountId },
      data: { planId: plan.id, status: 'ACTIVE' },
    });
    await db.plan.update({ where: { id: plan.id }, data: { limits: { classes: 'lots' } } });

    const entitlements = await billing().entitlementsFor(fixture.schoolAccountId);

    // One malformed row degrades that school rather than throwing on every request that reads it.
    expect(entitlements.limits).toEqual({ classes: 5, members: 200 });
  });
});
