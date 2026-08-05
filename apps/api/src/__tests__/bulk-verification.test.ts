/**
 * Deciding several verification requests at once — FR-VER-009.
 *
 * A school at the start of a term has a queue of a hundred students, and approving them one click
 * at a time is the sort of thing that makes people stop doing it.
 *
 * The design question is what happens when some of them fail, and the answer is **not one
 * transaction**: a school approving forty people while its plan allows thirty should end up with
 * thirty more members and a list of ten that did not fit — not zero members and an error. So the
 * response is per-request, and every decision goes through the single-decision path with its
 * authorization, its entitlement check, and its event intact.
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
import type { BulkVerificationResultResponse } from '@connected/types';
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

/** A fresh applicant with a pending request against the fixture school. */
async function pendingRequest(): Promise<string> {
  const applicant = await db.account.create({
    data: {
      email: `applicant-${crypto.randomUUID()}@fixture.test`,
      type: 'INDIVIDUAL',
      userProfile: {
        create: {
          fullName: 'Applicant',
          handle: `applicant${String(Date.now())}${String(Math.floor(Math.random() * 100000))}`,
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

const decideMany = async (requestIds: string[], decision = 'APPROVE', note?: string) =>
  request(app)
    .post('/api/v1/verifications/decisions')
    .set('Authorization', await asSchool())
    .send({ requestIds, decision, ...(note ? { note } : {}) });

describe('deciding many', () => {
  it('approves all of them', async () => {
    const ids = [await pendingRequest(), await pendingRequest(), await pendingRequest()];

    const response = await decideMany(ids);

    expect(response.status).toBe(200);
    const body = bodyAs<BulkVerificationResultResponse>(response);
    expect(body.decided).toHaveLength(3);
    expect(body.failed).toHaveLength(0);

    // Five from the fixture, plus three.
    expect(await db.membership.count({ where: { schoolId: fixture.schoolAccountId } })).toBe(8);
  });

  it('rejects all of them', async () => {
    const ids = [await pendingRequest(), await pendingRequest()];

    await decideMany(ids, 'REJECT');

    const rows = await db.verificationRequest.findMany({ where: { id: { in: ids } } });
    expect(rows.every((row) => row.status === 'REJECTED')).toBe(true);
    expect(await db.membership.count({ where: { schoolId: fixture.schoolAccountId } })).toBe(5);
  });

  it('records the note against every one', async () => {
    const ids = [await pendingRequest(), await pendingRequest()];

    await decideMany(ids, 'APPROVE', 'Enrolled this term.');

    const audits = await db.auditLog.findMany({
      where: { entity: 'verification_request', entityId: { in: ids } },
    });
    expect(audits).toHaveLength(2);
    expect(
      audits.every((row) => JSON.stringify(row.metadata).includes('Enrolled this term.')),
    ).toBe(true);
  });
});

describe('when some of them fail', () => {
  it('keeps the ones that worked', async () => {
    const good = await pendingRequest();
    const alreadyDecided = await pendingRequest();

    await request(app)
      .post(`/api/v1/verifications/${alreadyDecided}/decision`)
      .set('Authorization', await asSchool())
      .send({ decision: 'REJECT' });

    const body = bodyAs<BulkVerificationResultResponse>(await decideMany([good, alreadyDecided]));

    // Not one transaction. One refusal must not undo the decisions that worked.
    expect(body.decided).toEqual([good]);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]?.requestId).toBe(alreadyDecided);
  });

  it('says why each one failed', async () => {
    const missing = crypto.randomUUID();

    const body = bodyAs<BulkVerificationResultResponse>(await decideMany([missing]));

    // A school needs to know which ones did not go through and why, not that something failed.
    expect(body.failed[0]?.reason).toBeTruthy();
    expect(body.decided).toHaveLength(0);
  });

  it('stops at the plan limit and reports the rest', async () => {
    const plan = await db.plan.create({
      data: {
        code: `bulk-${crypto.randomUUID()}`,
        name: 'Small',
        // Five verified members already exist, so exactly one more fits.
        limits: { classes: null, members: 6 },
        features: { advancedAnalytics: false },
      },
    });
    await db.subscription.update({
      where: { schoolId: fixture.schoolAccountId },
      data: { planId: plan.id, status: 'ACTIVE' },
    });

    const ids = [await pendingRequest(), await pendingRequest(), await pendingRequest()];
    const body = bodyAs<BulkVerificationResultResponse>(await decideMany(ids));

    // The case this shape exists for: thirty members and a list of ten, rather than zero and an
    // error. The entitlement check is the single-decision one, unchanged.
    expect(body.decided).toHaveLength(1);
    expect(body.failed).toHaveLength(2);
    expect(await db.membership.count({ where: { schoolId: fixture.schoolAccountId } })).toBe(6);
  });
});

describe('authorization', () => {
  it('refuses another school', async () => {
    const id = await pendingRequest();
    const other = await seedSchool(db);

    const response = await request(app)
      .post('/api/v1/verifications/decisions')
      .set('Authorization', await auth(other.schoolAccountId, 'SCHOOL'))
      .send({ requestIds: [id], decision: 'APPROVE' });

    // The batch cannot be a way around the per-request check: each one goes through `decide`,
    // which 404s for somebody else's request.
    expect(bodyAs<BulkVerificationResultResponse>(response).decided).toHaveLength(0);
    expect(await db.membership.count({ where: { schoolId: fixture.schoolAccountId } })).toBe(5);
  });

  it('refuses a principal', async () => {
    const id = await pendingRequest();

    const response = await request(app)
      .post('/api/v1/verifications/decisions')
      .set('Authorization', await auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL'));

    expect([403, 404, 422]).toContain(response.status);
    expect(await db.verificationRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'PENDING',
    });
  });

  it('refuses an unauthenticated caller', async () => {
    expect((await request(app).post('/api/v1/verifications/decisions')).status).toBe(401);
  });
});

describe('what it will not accept', () => {
  it('refuses an empty list', async () => {
    expect((await decideMany([])).status).toBe(422);
  });

  it('refuses more than a hundred at once', async () => {
    const ids = Array.from({ length: 101 }, () => crypto.randomUUID());
    expect((await decideMany(ids)).status).toBe(422);
  });

  it('refuses a decision nobody defined', async () => {
    expect((await decideMany([crypto.randomUUID()], 'MAYBE')).status).toBe(422);
  });

  it('does not mistake the route for a request id', async () => {
    // `/verifications/decisions` must not be matched as `/verifications/:id/...`, which would
    // reject it with a message about a malformed identifier.
    const response = await decideMany([await pendingRequest()]);
    expect(response.status).toBe(200);
  });
});
