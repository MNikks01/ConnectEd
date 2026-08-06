/**
 * More than one principal at a school — FR-INST-007.
 *
 * The PRD left this as a question with an assumption attached: *"multiple principals? (default:
 * one)"*, single in v1, multi later. It has now been decided as multi, and the first thing that
 * decision needs is an honest answer to what the code already does.
 *
 * **It already does it.** Nothing anywhere enforces one principal per school: every principal check
 * is `assertVerifiedMembership(db, actor, schoolId, 'PRINCIPAL')`, which asks whether *this* caller
 * holds that membership and never how many others do. The unique constraint on membership is
 * `(account_id, school_id, role, scope_key)` — it stops one account holding the same membership
 * twice, not two accounts holding the same role.
 *
 * That makes this file the requirement rather than an addition to it. A capability nobody has
 * exercised is a capability nobody can rely on, and "it should work, there is no check against it"
 * is exactly the reasoning that produced the legacy product's authorization model. So each of the
 * three things the decision actually promises is asserted here:
 *
 * 1. a school can verify a second principal at all;
 * 2. the second one can do everything the first can;
 * 3. the second one can do **nothing more** — a principal is not a school account, and two of them
 *    must not add up to one.
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
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;
/** The second principal, verified in `beforeEach` the way a real one would be. */
let second: string;

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
  second = await verifySecondPrincipal();
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
const asFirst = () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL');
const asSecond = () => auth(second, 'INDIVIDUAL', 'PRINCIPAL');

/**
 * The whole path a second principal actually takes: an account, a request, the school's approval.
 *
 * Deliberately not a `membership.create` in the fixture. Inserting the row directly would prove
 * that N rows can exist, which was never in doubt; what needs proving is that the flow a school
 * uses will produce the second one.
 */
async function verifySecondPrincipal(): Promise<string> {
  const account = await db.account.create({
    data: {
      email: `second-principal-${crypto.randomUUID()}@fixture.test`,
      type: 'INDIVIDUAL',
      userProfile: {
        create: {
          fullName: 'The Other Principal',
          handle: `principal${String(Date.now())}${String(Math.floor(Math.random() * 100000))}`,
          role: 'USER',
        },
      },
    },
    select: { id: true },
  });

  const submitted = await request(app)
    .post('/api/v1/verifications')
    .set('Authorization', await auth(account.id, 'INDIVIDUAL', 'USER'))
    .send({ role: 'PRINCIPAL', schoolId: fixture.schoolAccountId });

  expect(submitted.status, `setup: submitting failed — ${submitted.text}`).toBe(201);

  const decided = await request(app)
    .post(`/api/v1/verifications/${bodyAs<{ id: string }>(submitted).id}/decision`)
    .set('Authorization', await asSchool())
    .send({ decision: 'APPROVE' });

  expect(decided.status, `setup: approving the second principal failed — ${decided.text}`).toBe(
    200,
  );

  return account.id;
}

describe('a school with two principals', () => {
  it('has two verified principal memberships and no complaint from the database', async () => {
    const principals = await db.membership.findMany({
      where: { schoolId: fixture.schoolAccountId, role: 'PRINCIPAL', status: 'VERIFIED' },
      select: { accountId: true },
    });

    // The unique constraint is per account, not per role — which is what makes this possible at
    // all, and is worth asserting so a future "tighten the membership key" change has to see it.
    expect(principals.map((row) => row.accountId).sort()).toEqual(
      [fixture.principalAccountId, second].sort(),
    );
  });

  it('shows both on the roster', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/members`)
      .set('Authorization', await asSchool());

    const roster = bodyAs<{ data: { accountId: string; role: string }[] }>(response).data;
    const listed = roster.filter((row) => row.role === 'PRINCIPAL').map((row) => row.accountId);

    // A school that cannot see the second one on its own roster cannot remove them either.
    expect(listed.sort()).toEqual([fixture.principalAccountId, second].sort());
  });
});

describe('what the second principal can do', () => {
  it('publishes a notice to the school', async () => {
    const response = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
      .set('Authorization', await asSecond())
      .send({ title: 'Sports day', body: 'Bring a hat.', audience: 'ALL' });

    expect(response.status, response.text).toBe(201);
  });

  it('reads the complaints queue', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/feedback`)
      .set('Authorization', await asSecond());

    expect(response.status).toBe(200);
  });

  it('decides a teacher’s leave, and the first principal sees the same queue', async () => {
    const applied = await request(app)
      .post('/api/v1/me/leave')
      .set('Authorization', await auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'))
      .send({
        schoolId: fixture.schoolAccountId,
        startDate: '2026-09-01',
        endDate: '2026-09-02',
        reason: 'A hospital appointment.',
      });
    expect(applied.status, applied.text).toBe(201);

    const queueFor = async (authorization: string) =>
      bodyAs<{ data: { id: string }[] }>(
        await request(app)
          .get(`/api/v1/schools/${fixture.schoolAccountId}/leave/teacher`)
          .set('Authorization', authorization),
      ).data.map((row) => row.id);

    // The same queue for both. A second principal seeing a different list would mean the queue was
    // scoped to a person rather than to the school, which is the bug this asserts against.
    expect(await queueFor(await asSecond())).toEqual(await queueFor(await asFirst()));

    const decided = await request(app)
      .post(`/api/v1/leave/${bodyAs<{ id: string }>(applied).id}/decision`)
      .set('Authorization', await asSecond())
      .send({ decision: 'ACCEPT' });

    expect(decided.status, decided.text).toBe(200);
  });

  it('cannot decide the same leave twice, whichever principal got there first', async () => {
    const applied = await request(app)
      .post('/api/v1/me/leave')
      .set('Authorization', await auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'))
      .send({
        schoolId: fixture.schoolAccountId,
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        reason: 'A conference.',
      });
    const leaveId = bodyAs<{ id: string }>(applied).id;

    const decide = async (authorization: string, decision: string) =>
      request(app)
        .post(`/api/v1/leave/${leaveId}/decision`)
        .set('Authorization', authorization)
        .send({ decision });

    expect((await decide(await asFirst(), 'ACCEPT')).status).toBe(200);

    // The reason two principals need this: both queues showed the same row, so both could act on
    // it. The second one is told, rather than silently overwriting the first one's answer.
    expect((await decide(await asSecond(), 'REJECT')).status).toBe(409);
  });
});

describe('what the second principal still cannot do', () => {
  /** Everything a principal is denied in the permission matrix, asked again as the second one. */
  const denied = [403, 404];

  it('cannot review the verification queue', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/verifications`)
      .set('Authorization', await asSecond());

    expect(denied).toContain(response.status);
  });

  it('cannot verify anybody', async () => {
    const applicant = await db.account.create({
      data: {
        email: `hopeful-${crypto.randomUUID()}@fixture.test`,
        type: 'INDIVIDUAL',
        userProfile: {
          create: {
            fullName: 'Hopeful',
            handle: `hopeful${String(Date.now())}`,
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

    const decided = await request(app)
      .post(`/api/v1/verifications/${bodyAs<{ id: string }>(submitted).id}/decision`)
      .set('Authorization', await asSecond())
      .send({ decision: 'APPROVE' });

    expect(denied).toContain(decided.status);
    // And nothing happened, which is the part a status code alone would not prove.
    expect(
      await db.membership.count({ where: { accountId: applicant.id, status: 'VERIFIED' } }),
    ).toBe(0);
  });

  it('cannot change the school profile', async () => {
    const response = await request(app)
      .patch(`/api/v1/schools/${fixture.schoolAccountId}`)
      .set('Authorization', await asSecond())
      .send({ name: 'A Principal Was Here' });

    expect(denied).toContain(response.status);
  });

  it('cannot read the school’s analytics', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/analytics`)
      .set('Authorization', await asSecond());

    expect(denied).toContain(response.status);
  });

  it('cannot see the subscription', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/subscription`)
      .set('Authorization', await asSecond());

    expect(denied).toContain(response.status);
  });

  it('cannot allocate a class teacher', async () => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/class-teacher`)
      .set('Authorization', await asSecond())
      .send({ teacherAccountId: fixture.teacherAccountId });

    // Two principals must not add up to a school account. This is the capability that would make
    // them one, because it decides who holds authority over a class.
    expect(denied).toContain(response.status);
  });
});

describe('removing one', () => {
  it('leaves the other one working', async () => {
    const removed = await request(app)
      .delete(`/api/v1/schools/${fixture.schoolAccountId}/members/${fixture.principalAccountId}`)
      .set('Authorization', await asSchool());
    expect(removed.status, removed.text).toBe(204);

    const stillWorks = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/feedback`)
      .set('Authorization', await asSecond());

    expect(stillWorks.status).toBe(200);
  });

  it('takes the removed one’s access away immediately', async () => {
    await request(app)
      .delete(`/api/v1/schools/${fixture.schoolAccountId}/members/${second}`)
      .set('Authorization', await asSchool());

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/feedback`)
      .set('Authorization', await asSecond());

    // FR-INST-005: removal revokes academic access immediately. The token is still valid — it is
    // the membership that is gone, which is why authorization reads the database on every request.
    expect(denied()).toContain(response.status);
  });
});

function denied(): number[] {
  return [403, 404];
}
