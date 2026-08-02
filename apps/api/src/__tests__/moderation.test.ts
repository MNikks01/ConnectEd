/**
 * Blocking and reporting — S4-8 (`PRD/06-social.md`, Moderation & safety).
 *
 * The filter has existed since S4-2; this is the half a person can use. The tests that matter are
 * the end-to-end ones: blocking from the API must actually silence the feed, the comment list, the
 * inbox and the badge — the four places the filter had to be threaded through separately.
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
import type {
  BlockListResponse,
  BlockResponse,
  InboxResponse,
  PostResponse,
  ReportResponse,
} from '@connected/types';
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

const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER');

async function blockVia(authorization: string, accountId: string): Promise<void> {
  const response = await request(app)
    .post(`/api/v1/accounts/${accountId}/block`)
    .set('Authorization', authorization);

  expect(response.status, `setup: blocking failed — ${response.text}`).toBe(200);
}

async function givenPost(authorization: string, body: string): Promise<PostResponse> {
  const response = await request(app)
    .post('/api/v1/posts')
    .set('Authorization', authorization)
    .send({ body });

  expect(response.status, `setup: publishing failed — ${response.text}`).toBe(201);
  return bodyAs<PostResponse>(response);
}

describe('blocking', () => {
  it('blocks, lists, and unblocks', async () => {
    const blocked = await request(app)
      .post(`/api/v1/accounts/${fixture.teacherAccountId}/block`)
      .set('Authorization', await asStudent());

    expect(bodyAs<BlockResponse>(blocked)).toMatchObject({ blocked: true });

    const list = await request(app)
      .get('/api/v1/me/blocks')
      .set('Authorization', await asStudent());

    expect(bodyAs<BlockListResponse>(list).data.map((card) => card.accountId)).toEqual([
      fixture.teacherAccountId,
    ]);

    const unblocked = await request(app)
      .delete(`/api/v1/accounts/${fixture.teacherAccountId}/block`)
      .set('Authorization', await asStudent());

    expect(bodyAs<BlockResponse>(unblocked).blocked).toBe(false);
    expect(await db.block.count()).toBe(0);
  });

  it('is idempotent', async () => {
    await blockVia(await asStudent(), fixture.teacherAccountId);
    await blockVia(await asStudent(), fixture.teacherAccountId);

    expect(await db.block.count()).toBe(1);
  });

  it('refuses blocking yourself', async () => {
    const response = await request(app)
      .post(`/api/v1/accounts/${fixture.studentAccountId}/block`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(422);
  });

  it('never tells you who has blocked you', async () => {
    await blockVia(await asTeacher(), fixture.studentAccountId);

    const list = await request(app)
      .get('/api/v1/me/blocks')
      .set('Authorization', await asStudent());

    // The list is who *you* blocked. The other direction is not disclosed anywhere.
    expect(bodyAs<BlockListResponse>(list).data).toHaveLength(0);
  });

  /** Blocking from the API must reach every read the filter was threaded through. */
  it('silences the feed', async () => {
    await db.follow.create({
      data: {
        followerAccountId: fixture.studentAccountId,
        followeeAccountId: fixture.teacherAccountId,
      },
    });
    await givenPost(await asTeacher(), 'Before the block.');

    await blockVia(await asStudent(), fixture.teacherAccountId);

    const feed = await request(app)
      .get('/api/v1/feed')
      .set('Authorization', await asStudent());

    expect(bodyAs<{ data: PostResponse[] }>(feed).data).toHaveLength(0);
  });

  it('silences comments under a post the caller can still see', async () => {
    const post = await givenPost(await asStudent(), 'My own post.');

    await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asTeacher())
      .send({ body: 'A comment.' });

    await blockVia(await asStudent(), fixture.teacherAccountId);

    const comments = await request(app)
      .get(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asStudent());

    expect(bodyAs<{ data: unknown[] }>(comments).data).toHaveLength(0);
  });

  it('empties the inbox and the unread badge', async () => {
    const thread = bodyAs<{ id: string }>(
      await request(app)
        .post('/api/v1/threads')
        .set('Authorization', await asTeacher())
        .send({ accountId: fixture.studentAccountId }),
    );

    await request(app)
      .post(`/api/v1/threads/${thread.id}/messages`)
      .set('Authorization', await asTeacher())
      .send({ body: 'Unread when the block lands.' });

    await blockVia(await asStudent(), fixture.teacherAccountId);

    const inbox = bodyAs<InboxResponse>(
      await request(app)
        .get('/api/v1/threads')
        .set('Authorization', await asStudent()),
    );

    expect(inbox.data).toHaveLength(0);
    expect(inbox.unreadTotal).toBe(0);
  });

  it('restores the world on unblock rather than clearing it', async () => {
    await db.follow.create({
      data: {
        followerAccountId: fixture.studentAccountId,
        followeeAccountId: fixture.teacherAccountId,
      },
    });
    await givenPost(await asTeacher(), 'Still here afterwards.');

    await blockVia(await asStudent(), fixture.teacherAccountId);
    await request(app)
      .delete(`/api/v1/accounts/${fixture.teacherAccountId}/block`)
      .set('Authorization', await asStudent());

    const feed = await request(app)
      .get('/api/v1/feed')
      .set('Authorization', await asStudent());

    // Blocking does not tear down follows: someone who blocks in anger and relents an hour later
    // should get their world back, not a cleared list.
    expect(bodyAs<{ data: PostResponse[] }>(feed).data).toHaveLength(1);
  });
});

describe('reporting', () => {
  it('records a report about a post', async () => {
    const post = await givenPost(await asTeacher(), 'Something objectionable.');

    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({ subjectType: 'POST', subjectId: post.id, reason: 'This is not appropriate.' });

    expect(response.status).toBe(201);
    expect(bodyAs<ReportResponse>(response).status).toBe('OPEN');
  });

  it('records a report about an account', async () => {
    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({
        subjectType: 'ACCOUNT',
        subjectId: fixture.teacherAccountId,
        reason: 'Impersonating a teacher.',
      });

    expect(response.status).toBe(201);
  });

  it('treats a second report of the same thing as the same complaint', async () => {
    const post = await givenPost(await asTeacher(), 'Something objectionable.');
    const body = { subjectType: 'POST', subjectId: post.id, reason: 'Not appropriate.' };

    await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send(body);
    const second = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({ ...body, reason: 'Still not appropriate.' });

    expect(second.status).toBe(201);
    expect(await db.report.count()).toBe(1);
  });

  it('still lets two different people report the same thing', async () => {
    const post = await givenPost(await asTeacher(), 'Something objectionable.');
    const body = { subjectType: 'POST', subjectId: post.id, reason: 'Not appropriate.' };

    await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send(body);
    await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asOutsider())
      .send(body);

    // Two people objecting is two data points, which is the whole signal a queue would rank by.
    expect(await db.report.count()).toBe(2);
  });

  it('refuses a report about something that does not exist', async () => {
    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({ subjectType: 'POST', subjectId: crypto.randomUUID(), reason: 'Nothing here.' });

    expect(response.status).toBe(404);
    expect(await db.report.count()).toBe(0);
  });

  it('still accepts a report about content its author deleted', async () => {
    const post = await givenPost(await asTeacher(), 'Deleted in a hurry.');

    await request(app)
      .delete(`/api/v1/posts/${post.id}`)
      .set('Authorization', await asTeacher());

    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({ subjectType: 'POST', subjectId: post.id, reason: 'It was there a moment ago.' });

    // The case moderation most needs: soft delete keeps the content, so the report can name it.
    expect(response.status).toBe(201);
  });

  it('refuses reporting yourself', async () => {
    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({
        subjectType: 'ACCOUNT',
        subjectId: fixture.studentAccountId,
        reason: 'Testing.',
      });

    expect(response.status).toBe(422);
  });

  it('rejects an empty reason', async () => {
    const post = await givenPost(await asTeacher(), 'Something.');

    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({ subjectType: 'POST', subjectId: post.id, reason: '   ' });

    expect(response.status).toBe(422);
  });

  it('shows a reporter their own reports and nobody else’s', async () => {
    const post = await givenPost(await asTeacher(), 'Something.');

    await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({ subjectType: 'POST', subjectId: post.id, reason: 'Not appropriate.' });

    const mine = await request(app)
      .get('/api/v1/me/reports')
      .set('Authorization', await asStudent());
    const theirs = await request(app)
      .get('/api/v1/me/reports')
      .set('Authorization', await asOutsider());

    expect(bodyAs<{ data: ReportResponse[] }>(mine).data).toHaveLength(1);
    expect(bodyAs<{ data: ReportResponse[] }>(theirs).data).toHaveLength(0);
  });

  it('lets a blocked account still report the person who blocked them', async () => {
    const post = await givenPost(await asTeacher(), 'Something objectionable.');
    await blockVia(await asTeacher(), fixture.studentAccountId);

    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({ subjectType: 'POST', subjectId: post.id, reason: 'I saw this before the block.' });

    // Blocking someone must not stop them reporting you. Otherwise the first move of anyone
    // behaving badly is to block the person who would report it.
    expect(response.status).toBe(201);
  });
});
