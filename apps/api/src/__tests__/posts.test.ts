/**
 * Posts — S4-2 (FR-SOC-002, 004), and the blocking filter underneath them.
 *
 * Blocking is built here rather than with the report-and-block endpoints in S4-8, because the
 * filter is the part that is expensive to retrofit: a block honoured by the timeline but not by
 * the feed, or by the feed but not by a comment list, is not a block. One helper in the repository
 * applies it to every read, and these tests are what hold that.
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
import type { Storage } from '../shared/storage/index.js';
import type { PostResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

interface PostPage {
  data: PostResponse[];
  nextCursor: string | null;
}

function fakeStorage(): Storage {
  return {
    putImage: ({ body, contentType, prefix }) =>
      Promise.resolve({ key: `${prefix}/x.bin`, contentType, size: body.length }),
    signedUrl: (key) => Promise.resolve(`https://signed.test/${key}`),
    remove: () => Promise.resolve(),
    ping: () => Promise.resolve(),
    ensureBucket: () => Promise.resolve(),
  };
}

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ db, config, storage: fakeStorage() });
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
const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL');
/** Verified nowhere — and, this being social, entitled to everything anyway. */
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER');

async function post(authorization: string, body = 'Sports day was a great success.') {
  return request(app).post('/api/v1/posts').set('Authorization', authorization).send({ body });
}

/** Publishes as setup and proves it worked, so a later assertion cannot blame the wrong step. */
async function givenPost(authorization: string, body?: string): Promise<PostResponse> {
  const response = await post(authorization, body);
  expect(response.status, `setup: publishing failed — ${response.text}`).toBe(201);
  return bodyAs<PostResponse>(response);
}

async function block(blocker: string, blocked: string): Promise<void> {
  await db.block.create({ data: { blockerAccountId: blocker, blockedAccountId: blocked } });
}

describe('POST /posts — publishing (FR-SOC-002)', () => {
  it.each([
    ['a student', () => asStudent()],
    ['a school', () => asSchool()],
    ['an account verified nowhere', () => asOutsider()],
  ])('lets %s publish', async (_label, authorization) => {
    const response = await post(await authorization());

    expect(response.status).toBe(201);

    const created = bodyAs<PostResponse>(response);
    expect(created.mine).toBe(true);
    expect(created.editedAt).toBeNull();
    expect(created.author.displayName).toBeTruthy();
  });

  it('requires a session', async () => {
    const response = await request(app).post('/api/v1/posts').send({ body: 'Anonymous.' });

    expect(response.status).toBe(401);
  });

  it('rejects an empty body', async () => {
    const response = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', await asStudent())
      .send({ body: '   ' });

    expect(response.status).toBe(422);
  });

  it('names the school as the author when a school posts', async () => {
    const created = await givenPost(await asSchool());

    expect(created.author).toMatchObject({
      accountType: 'SCHOOL',
      displayName: 'Fixture School',
    });
  });
});

describe('GET /accounts/:id/posts — a timeline', () => {
  it('lists an account’s posts, newest first', async () => {
    await givenPost(await asStudent(), 'First.');
    await givenPost(await asStudent(), 'Second.');

    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/posts`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<PostPage>(response).data.map((row) => row.body)).toEqual(['Second.', 'First.']);
  });

  it('shows only that account’s posts', async () => {
    await givenPost(await asStudent(), 'Mine.');
    await givenPost(await asTeacher(), 'Theirs.');

    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/posts`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<PostPage>(response).data.map((row) => row.body)).toEqual(['Mine.']);
  });

  it('marks a post as the caller’s own only for its author', async () => {
    await givenPost(await asStudent());

    const forAuthor = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/posts`)
      .set('Authorization', await asStudent());
    const forOther = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/posts`)
      .set('Authorization', await asTeacher());

    expect(bodyAs<PostPage>(forAuthor).data[0]?.mine).toBe(true);
    expect(bodyAs<PostPage>(forOther).data[0]?.mine).toBe(false);
  });
});

describe('editing and deleting (FR-SOC-004)', () => {
  it('lets the author edit, and records that it was edited', async () => {
    const created = await givenPost(await asStudent());

    const response = await request(app)
      .patch(`/api/v1/posts/${created.id}`)
      .set('Authorization', await asStudent())
      .send({ body: 'Corrected.' });

    expect(response.status).toBe(200);

    const updated = bodyAs<PostResponse>(response);
    expect(updated.body).toBe('Corrected.');
    // A reader deserves to know a post changed after it was published.
    expect(updated.editedAt).toEqual(expect.any(String));
  });

  it('refuses anyone else editing', async () => {
    const created = await givenPost(await asStudent());

    const response = await request(app)
      .patch(`/api/v1/posts/${created.id}`)
      .set('Authorization', await asTeacher())
      .send({ body: 'Hijacked.' });

    expect(response.status).toBe(403);
  });

  it('refuses anyone else deleting, including a school', async () => {
    const created = await givenPost(await asStudent());

    const response = await request(app)
      .delete(`/api/v1/posts/${created.id}`)
      .set('Authorization', await asSchool());

    // Social has no institutional authority: a school is a peer here, not an owner.
    expect(response.status).toBe(403);
  });

  it('soft-deletes, so moderation still has the content', async () => {
    const created = await givenPost(await asStudent());

    await request(app)
      .delete(`/api/v1/posts/${created.id}`)
      .set('Authorization', await asStudent());

    const read = await request(app)
      .get(`/api/v1/posts/${created.id}`)
      .set('Authorization', await asOutsider());

    expect(read.status).toBe(404);
    // Still in the table: a report about a deleted post is the case that most needs the post.
    expect(await db.post.count({ where: { id: created.id } })).toBe(1);
  });

  it('will not edit a post that has been deleted', async () => {
    const created = await givenPost(await asStudent());

    await request(app)
      .delete(`/api/v1/posts/${created.id}`)
      .set('Authorization', await asStudent());

    const response = await request(app)
      .patch(`/api/v1/posts/${created.id}`)
      .set('Authorization', await asStudent())
      .send({ body: 'Undeleted?' });

    expect(response.status).toBe(404);
  });
});

describe('blocking', () => {
  it('hides a blocked account’s posts from the blocker', async () => {
    await givenPost(await asTeacher(), 'From someone blocked.');
    await block(fixture.studentAccountId, fixture.teacherAccountId);

    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.teacherAccountId}/posts`)
      .set('Authorization', await asStudent());

    expect(bodyAs<PostPage>(response).data).toHaveLength(0);
  });

  /** The half that a naive implementation misses. */
  it('hides the blocker’s posts from the blocked account too', async () => {
    await givenPost(await asStudent(), 'From the blocker.');
    await block(fixture.studentAccountId, fixture.teacherAccountId);

    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/posts`)
      .set('Authorization', await asTeacher());

    // Otherwise blocking is a one-sided mute the other party can work around by looking.
    expect(bodyAs<PostPage>(response).data).toHaveLength(0);
  });

  it('leaves everyone else’s view alone', async () => {
    await givenPost(await asTeacher(), 'Visible to third parties.');
    await block(fixture.studentAccountId, fixture.teacherAccountId);

    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.teacherAccountId}/posts`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<PostPage>(response).data).toHaveLength(1);
  });

  it('applies to a single post read, not only to lists', async () => {
    const created = await givenPost(await asTeacher());
    await block(fixture.studentAccountId, fixture.teacherAccountId);

    const response = await request(app)
      .get(`/api/v1/posts/${created.id}`)
      .set('Authorization', await asStudent());

    // 404, not 403: a blocked account should not learn what it is being kept from.
    expect(response.status).toBe(404);
  });

  it('does not stop the author editing their own post', async () => {
    const created = await givenPost(await asTeacher());
    await block(fixture.studentAccountId, fixture.teacherAccountId);

    const response = await request(app)
      .patch(`/api/v1/posts/${created.id}`)
      .set('Authorization', await asTeacher())
      .send({ body: 'Still mine.' });

    expect(response.status).toBe(200);
  });
});
