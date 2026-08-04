/**
 * School analytics — S6-7 (`PRD/08-billing.md`, `advancedAnalytics`).
 *
 * The claim that matters is not the arithmetic. It is that **this is the one endpoint in the
 * product where a plan gates a read**, and that the exception is narrow: analytics is a report we
 * compute, not the school's own data being withheld. So the tests below check both that the gate
 * works and that it has not spread — a school locked out of analytics can still see its classes,
 * its notices, and everything it wrote.
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
import type { ErrorEnvelope, SchoolAnalyticsResponse } from '@connected/types';
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

/** Puts the fixture school on a named plan. The fixture starts on the trial. */
async function onPlan(code: string) {
  const plan = await db.plan.findUniqueOrThrow({ where: { code } });
  await db.subscription.update({
    where: { schoolId: fixture.schoolAccountId },
    data: { planId: plan.id, status: 'ACTIVE' },
  });
}

const fetchAnalytics = async (query = '') =>
  request(app)
    .get(`/api/v1/schools/${fixture.schoolAccountId}/analytics${query}`)
    .set('Authorization', await asSchool());

describe('the entitlement', () => {
  it('refuses a school whose plan does not include it', async () => {
    // The fixture is on the trial, which does not.
    const response = await fetchAnalytics();

    expect(response.status).toBe(402);
    expect(bodyAs<ErrorEnvelope>(response).error.code).toBe('FEATURE_NOT_IN_PLAN');
  });

  it('names the feature and the plan that has it', async () => {
    const body = bodyAs<ErrorEnvelope>(await fetchAnalytics());

    // A school told "upgrade" and not told to what has been sold nothing.
    expect(body.error.message).toContain('advanced analytics');
    expect(body.error.message).toContain('Premium');
    expect(body.error.details).toEqual([
      { field: 'advanced analytics', issue: 'not included in Trial' },
    ]);
  });

  it('lets a school on a plan that includes it through', async () => {
    await onPlan('premium');

    expect((await fetchAnalytics()).status).toBe(200);
  });

  it('takes it away again when the subscription is cancelled', async () => {
    await onPlan('premium');
    await db.subscription.update({
      where: { schoolId: fixture.schoolAccountId },
      data: { status: 'CANCELED' },
    });

    // Cancelling resolves to the floor, and the floor has no analytics. The school keeps its data
    // — see below — but not a report we compute for it.
    expect((await fetchAnalytics()).status).toBe(402);
  });

  it('keeps it during a failed payment', async () => {
    await onPlan('premium');
    await db.subscription.update({
      where: { schoolId: fixture.schoolAccountId },
      data: { status: 'PAST_DUE' },
    });

    // A bounced renewal is usually an expired card, and dunning decides when grace ends.
    expect((await fetchAnalytics()).status).toBe(200);
  });
});

describe('the exception does not spread', () => {
  it('leaves a school without analytics able to read everything it wrote', async () => {
    // The fixture is on the trial, so analytics is refused. Nothing else may be.
    expect((await fetchAnalytics()).status).toBe(402);

    const classes = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', await asSchool());
    const notices = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
      .set('Authorization', await asSchool());

    // This is the line S5-3 drew and this endpoint is the single, justified exception to it: a
    // plan may withhold a report we compute, never data the school itself created.
    expect(classes.status).toBe(200);
    expect(notices.status).toBe(200);
  });

  it('leaves a student able to read their own class', async () => {
    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/subjects`)
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    expect(response.status).toBe(200);
  });
});

describe('authorization comes first', () => {
  it('404s for another school rather than a 402 about its plan', async () => {
    const other = await seedSchool(db);
    await onPlan('premium');

    const response = await request(app)
      .get(`/api/v1/schools/${other.schoolAccountId}/analytics`)
      .set('Authorization', await asSchool());

    // A 402 here would confirm the other school exists and volunteer what it pays for.
    expect(response.status).toBe(404);
  });

  it('refuses the school’s own principal', async () => {
    await onPlan('premium');

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/analytics`)
      .set('Authorization', await auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL'));

    expect(response.status).toBe(403);
  });

  it('refuses an unauthenticated caller', async () => {
    const response = await request(app).get(`/api/v1/schools/${fixture.schoolAccountId}/analytics`);

    expect(response.status).toBe(401);
  });
});

describe('what it reports', () => {
  beforeEach(async () => {
    await onPlan('premium');
  });

  it('counts verified members by role, and nobody else', async () => {
    await db.membership.updateMany({
      where: { accountId: fixture.studentAccountId },
      data: { status: 'PENDING' },
    });

    const body = bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics());

    // The fixture has five verified memberships; one is now pending, so four remain.
    expect(body.membership.total).toBe(4);
    expect(body.membership.byRole.STUDENT).toBeUndefined();
    expect(body.membership.byRole.TEACHER).toBe(2);
  });

  it('counts the school’s structure', async () => {
    const body = bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics());

    expect(body.structure).toEqual({ classes: 2, subjects: 2 });
  });

  it('counts what was published inside the window and nothing outside it', async () => {
    await db.notice.create({
      data: {
        schoolId: fixture.schoolAccountId,
        authorAccountId: fixture.schoolAccountId,
        title: 'Recent',
        body: 'Inside the window.',
      },
    });
    await db.notice.create({
      data: {
        schoolId: fixture.schoolAccountId,
        authorAccountId: fixture.schoolAccountId,
        title: 'Ancient',
        body: 'Outside it.',
        createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      },
    });

    expect(bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics()).publishing.notices).toBe(1);
  });

  it('honours a wider window', async () => {
    await db.notice.create({
      data: {
        schoolId: fixture.schoolAccountId,
        authorAccountId: fixture.schoolAccountId,
        title: 'Older',
        body: 'Ninety days ago.',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    });

    expect(bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics()).publishing.notices).toBe(0);
    expect(
      bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics('?days=180')).publishing.notices,
    ).toBe(1);
  });

  it('ignores a soft-deleted notice', async () => {
    await db.notice.create({
      data: {
        schoolId: fixture.schoolAccountId,
        authorAccountId: fixture.schoolAccountId,
        title: 'Withdrawn',
        body: 'Taken down.',
        deletedAt: new Date(),
      },
    });

    // A withdrawn notice was published and then unpublished; counting it would tell a school it
    // communicated something its members cannot see.
    expect(bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics()).publishing.notices).toBe(0);
  });

  it('reports no read-rate when nothing was published', async () => {
    const body = bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics());

    // `null`, not zero. A school that posted nothing has no read-rate, and 0% would read as a
    // failure rather than as an absence.
    expect(body.engagement.noticeReadRate).toBeNull();
  });

  it('measures a read-rate against the verified membership', async () => {
    const notice = await db.notice.create({
      data: {
        schoolId: fixture.schoolAccountId,
        authorAccountId: fixture.schoolAccountId,
        title: 'Read me',
        body: 'Please.',
      },
      select: { id: true },
    });

    await db.readReceipt.create({
      data: {
        subjectType: 'NOTICE',
        subjectId: notice.id,
        accountId: fixture.studentAccountId,
      },
    });

    const body = bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics());

    // One notice, one reader, five verified members.
    expect(body.engagement.verifiedMembers).toBe(5);
    expect(body.engagement.noticeReadRate).toBeCloseTo(0.2);
  });

  it('never reports more than everyone', async () => {
    const notice = await db.notice.create({
      data: {
        schoolId: fixture.schoolAccountId,
        authorAccountId: fixture.schoolAccountId,
        title: 'Read me',
        body: 'Please.',
      },
      select: { id: true },
    });

    for (const accountId of [
      fixture.studentAccountId,
      fixture.teacherAccountId,
      fixture.parentAccountId,
      fixture.principalAccountId,
      fixture.otherTeacherAccountId,
      // Not a member of this school, and still able to have read a notice before being revoked.
      fixture.outsiderAccountId,
    ]) {
      await db.readReceipt.create({
        data: { subjectType: 'NOTICE', subjectId: notice.id, accountId },
      });
    }

    // Six readers against five members. A rate above 100% is a distraction, not a finding.
    expect(bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics()).engagement.noticeReadRate).toBe(
      1,
    );
  });

  it('falls back to the default window for a nonsense one', async () => {
    const body = bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics('?days=not-a-number'));

    // A dashboard control, not an API contract: a mistyped query string shows the default month
    // rather than an error page.
    expect(body.window.days).toBe(30);
  });

  it('caps how far back a caller may ask', async () => {
    const body = bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics('?days=99999'));

    expect(body.window.days).toBe(365);
  });

  it('reports only this school’s figures', async () => {
    const other = await seedSchool(db);
    await db.notice.create({
      data: {
        schoolId: other.schoolAccountId,
        authorAccountId: other.schoolAccountId,
        title: 'Somebody else’s',
        body: 'Not ours.',
      },
    });

    expect(bodyAs<SchoolAnalyticsResponse>(await fetchAnalytics()).publishing.notices).toBe(0);
  });
});
