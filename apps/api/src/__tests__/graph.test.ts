/**
 * Follows and connections — S4-4, S4-5 (FR-SOC-010, 011).
 *
 * The pair ordering is the thing to hold onto: a connection is stored once per *pair*, not once
 * per direction, so A→B and B→A are the same row. Without that, both could sit pending and a
 * connection could end up half-accepted in two places.
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
import type { ConnectionResponse, FollowStateResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

interface ConnectionList {
  data: ConnectionResponse[];
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

const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER');

async function block(blocker: string, blocked: string): Promise<void> {
  await db.block.create({ data: { blockerAccountId: blocker, blockedAccountId: blocked } });
}

/** Requests as setup and proves it worked. */
async function givenRequest(from: string, toAccountId: string): Promise<ConnectionResponse> {
  const response = await request(app)
    .post('/api/v1/connections')
    .set('Authorization', from)
    .send({ accountId: toAccountId });

  expect(response.status, `setup: requesting failed — ${response.text}`).toBe(201);
  return bodyAs<ConnectionResponse>(response);
}

describe('following (FR-SOC-010)', () => {
  it('follows, reports counts, and unfollows', async () => {
    const followed = await request(app)
      .post(`/api/v1/accounts/${fixture.teacherAccountId}/follow`)
      .set('Authorization', await asStudent());

    expect(bodyAs<FollowStateResponse>(followed)).toMatchObject({
      following: true,
      followerCount: 1,
    });

    const unfollowed = await request(app)
      .delete(`/api/v1/accounts/${fixture.teacherAccountId}/follow`)
      .set('Authorization', await asStudent());

    expect(bodyAs<FollowStateResponse>(unfollowed)).toMatchObject({
      following: false,
      followerCount: 0,
    });
  });

  it('is idempotent — following twice is following once', async () => {
    for (let i = 0; i < 2; i += 1) {
      await request(app)
        .post(`/api/v1/accounts/${fixture.teacherAccountId}/follow`)
        .set('Authorization', await asStudent());
    }

    expect(await db.follow.count()).toBe(1);
  });

  it('is directional — following someone does not make them follow you', async () => {
    await request(app)
      .post(`/api/v1/accounts/${fixture.teacherAccountId}/follow`)
      .set('Authorization', await asStudent());

    const theirView = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/follow`)
      .set('Authorization', await asTeacher());

    expect(bodyAs<FollowStateResponse>(theirView).following).toBe(false);
  });

  it('refuses following yourself', async () => {
    const response = await request(app)
      .post(`/api/v1/accounts/${fixture.studentAccountId}/follow`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(422);
  });

  it('lets anyone follow a school without being verified', async () => {
    const response = await request(app)
      .post(`/api/v1/accounts/${fixture.schoolAccountId}/follow`)
      .set('Authorization', await asOutsider());

    // Following a school is how a prospective parent keeps up with it — no membership needed.
    expect(bodyAs<FollowStateResponse>(response).following).toBe(true);
  });

  it('refuses following an account that has blocked you', async () => {
    await block(fixture.teacherAccountId, fixture.studentAccountId);

    const response = await request(app)
      .post(`/api/v1/accounts/${fixture.teacherAccountId}/follow`)
      .set('Authorization', await asStudent());

    // 404, not 403: "you are blocked" is information the block exists to withhold.
    expect(response.status).toBe(404);
  });

  it('still lets you unfollow an account you have blocked', async () => {
    await request(app)
      .post(`/api/v1/accounts/${fixture.teacherAccountId}/follow`)
      .set('Authorization', await asStudent());

    await block(fixture.studentAccountId, fixture.teacherAccountId);

    const response = await request(app)
      .delete(`/api/v1/accounts/${fixture.teacherAccountId}/follow`)
      .set('Authorization', await asStudent());

    // Otherwise a blocked account stays in your following list with no way to remove it.
    expect(response.status).toBe(200);
    expect(await db.follow.count()).toBe(0);
  });
});

describe('connections (FR-SOC-011)', () => {
  it('requests, then the other party accepts', async () => {
    const requested = await givenRequest(await asStudent(), fixture.teacherAccountId);

    expect(requested.status).toBe('PENDING');
    expect(requested.requestedByMe).toBe(true);

    const accepted = await request(app)
      .post(`/api/v1/connections/${requested.id}/accept`)
      .set('Authorization', await asTeacher());

    expect(bodyAs<ConnectionResponse>(accepted).status).toBe('ACCEPTED');
  });

  it('refuses the requester accepting their own', async () => {
    const requested = await givenRequest(await asStudent(), fixture.teacherAccountId);

    const response = await request(app)
      .post(`/api/v1/connections/${requested.id}/accept`)
      .set('Authorization', await asStudent());

    // A connection made from one person's decision is not mutual.
    expect(response.status).toBe(409);
  });

  it('refuses a stranger accepting someone else’s request', async () => {
    const requested = await givenRequest(await asStudent(), fixture.teacherAccountId);

    const response = await request(app)
      .post(`/api/v1/connections/${requested.id}/accept`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(404);
  });

  /** The reason the pair is stored in a fixed order. */
  it('treats a reverse request as the same pair, not a second row', async () => {
    await givenRequest(await asStudent(), fixture.teacherAccountId);

    const reverse = await request(app)
      .post('/api/v1/connections')
      .set('Authorization', await asTeacher())
      .send({ accountId: fixture.studentAccountId });

    expect(reverse.status).toBe(409);
    expect(await db.connection.count()).toBe(1);
  });

  it('refuses a second request once connected', async () => {
    const requested = await givenRequest(await asStudent(), fixture.teacherAccountId);
    await request(app)
      .post(`/api/v1/connections/${requested.id}/accept`)
      .set('Authorization', await asTeacher());

    const again = await request(app)
      .post('/api/v1/connections')
      .set('Authorization', await asStudent())
      .send({ accountId: fixture.teacherAccountId });

    expect(again.status).toBe(409);
  });

  it('refuses connecting with yourself', async () => {
    const response = await request(app)
      .post('/api/v1/connections')
      .set('Authorization', await asStudent())
      .send({ accountId: fixture.studentAccountId });

    expect(response.status).toBe(422);
  });

  it('refuses a request to someone who blocked you', async () => {
    await block(fixture.teacherAccountId, fixture.studentAccountId);

    const response = await request(app)
      .post('/api/v1/connections')
      .set('Authorization', await asStudent())
      .send({ accountId: fixture.teacherAccountId });

    expect(response.status).toBe(404);
    expect(await db.connection.count()).toBe(0);
  });

  it.each([
    ['the recipient rejecting', () => asTeacher()],
    ['the requester cancelling', () => asStudent()],
  ])('removes the row when %s', async (_label, authorization) => {
    const requested = await givenRequest(await asStudent(), fixture.teacherAccountId);

    const response = await request(app)
      .delete(`/api/v1/connections/${requested.id}`)
      .set('Authorization', await authorization());

    expect(response.status).toBe(204);
    expect(await db.connection.count()).toBe(0);
  });

  it('refuses a stranger removing a connection', async () => {
    const requested = await givenRequest(await asStudent(), fixture.teacherAccountId);

    const response = await request(app)
      .delete(`/api/v1/connections/${requested.id}`)
      .set('Authorization', await asOutsider());

    expect(response.status).toBe(404);
    expect(await db.connection.count()).toBe(1);
  });

  it('lets a request be made again after it was rejected', async () => {
    const requested = await givenRequest(await asStudent(), fixture.teacherAccountId);
    await request(app)
      .delete(`/api/v1/connections/${requested.id}`)
      .set('Authorization', await asTeacher());

    const again = await request(app)
      .post('/api/v1/connections')
      .set('Authorization', await asStudent())
      .send({ accountId: fixture.teacherAccountId });

    // Rejection removes the row rather than recording a refusal, so asking again is allowed. If
    // that becomes a way to pester someone, blocking is the answer the product already has.
    expect(again.status).toBe(201);
  });
});

describe('GET /me/connections', () => {
  it('shows both sides of the caller’s connections, with who asked', async () => {
    await givenRequest(await asStudent(), fixture.teacherAccountId);
    await givenRequest(await asOutsider(), fixture.studentAccountId);

    const response = await request(app)
      .get('/api/v1/me/connections')
      .set('Authorization', await asStudent());

    const mine = bodyAs<ConnectionList>(response).data;
    expect(mine).toHaveLength(2);
    // The other party, whichever side of the pair they were stored on.
    expect(mine.map((row) => row.other.accountId).sort()).toEqual(
      [fixture.teacherAccountId, fixture.outsiderAccountId].sort(),
    );
    expect(mine.filter((row) => row.requestedByMe)).toHaveLength(1);
  });

  it('filters by status', async () => {
    const first = await givenRequest(await asStudent(), fixture.teacherAccountId);
    await givenRequest(await asOutsider(), fixture.studentAccountId);

    await request(app)
      .post(`/api/v1/connections/${first.id}/accept`)
      .set('Authorization', await asTeacher());

    const pending = await request(app)
      .get('/api/v1/me/connections?status=PENDING')
      .set('Authorization', await asStudent());

    expect(bodyAs<ConnectionList>(pending).data).toHaveLength(1);
  });

  it('never shows someone else’s', async () => {
    await givenRequest(await asStudent(), fixture.teacherAccountId);

    const response = await request(app)
      .get('/api/v1/me/connections')
      .set('Authorization', await asOutsider());

    expect(bodyAs<ConnectionList>(response).data).toHaveLength(0);
  });
});
