/**
 * Likes and comments — S4-3 (FR-SOC-003, 004).
 *
 * The interesting cases are the ones where blocking meets an interaction: liking a post you cannot
 * see, and a blocked account's comment sitting under a post you can. A block honoured on the post
 * but not on its comments is the gap that makes blocking feel broken.
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
import type { CommentResponse, LikeResponse, PostResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

interface CommentList {
  data: CommentResponse[];
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

/** Publishes as setup and proves it worked. */
async function givenPost(authorization: string): Promise<PostResponse> {
  const response = await request(app)
    .post('/api/v1/posts')
    .set('Authorization', authorization)
    .send({ body: 'Sports day was a great success.' });

  expect(response.status, `setup: publishing failed — ${response.text}`).toBe(201);
  return bodyAs<PostResponse>(response);
}

async function block(blocker: string, blocked: string): Promise<void> {
  await db.block.create({ data: { blockerAccountId: blocker, blockedAccountId: blocked } });
}

describe('POST /posts/:id/like — a toggle (FR-SOC-003)', () => {
  it('likes, then unlikes, and reports the count', async () => {
    const post = await givenPost(await asStudent());

    const liked = await request(app)
      .post(`/api/v1/posts/${post.id}/like`)
      .set('Authorization', await asTeacher());
    const unliked = await request(app)
      .post(`/api/v1/posts/${post.id}/like`)
      .set('Authorization', await asTeacher());

    expect(bodyAs<LikeResponse>(liked)).toMatchObject({ liked: true, likeCount: 1 });
    expect(bodyAs<LikeResponse>(unliked)).toMatchObject({ liked: false, likeCount: 0 });
  });

  it('counts one like per account however many times they ask', async () => {
    const post = await givenPost(await asStudent());

    await request(app)
      .post(`/api/v1/posts/${post.id}/like`)
      .set('Authorization', await asTeacher());
    await request(app)
      .post(`/api/v1/posts/${post.id}/like`)
      .set('Authorization', await asOutsider());

    expect(await db.postLike.count({ where: { postId: post.id } })).toBe(2);
  });

  it('lets an author like their own post', async () => {
    const post = await givenPost(await asStudent());

    const response = await request(app)
      .post(`/api/v1/posts/${post.id}/like`)
      .set('Authorization', await asStudent());

    // Nothing in the PRD forbids it, and every product on earth allows it.
    expect(bodyAs<LikeResponse>(response).liked).toBe(true);
  });

  it('shows the caller their own like state on the post', async () => {
    const post = await givenPost(await asStudent());

    await request(app)
      .post(`/api/v1/posts/${post.id}/like`)
      .set('Authorization', await asTeacher());

    const forLiker = await request(app)
      .get(`/api/v1/posts/${post.id}`)
      .set('Authorization', await asTeacher());
    const forOther = await request(app)
      .get(`/api/v1/posts/${post.id}`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<PostResponse>(forLiker).liked).toBe(true);
    expect(bodyAs<PostResponse>(forOther).liked).toBe(false);
    expect(bodyAs<PostResponse>(forOther).likeCount).toBe(1);
  });

  it('refuses to like a post the caller cannot see', async () => {
    const post = await givenPost(await asTeacher());
    await block(fixture.studentAccountId, fixture.teacherAccountId);

    const response = await request(app)
      .post(`/api/v1/posts/${post.id}/like`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(404);
    expect(await db.postLike.count()).toBe(0);
  });

  it('refuses to like a deleted post', async () => {
    const post = await givenPost(await asStudent());

    await request(app)
      .delete(`/api/v1/posts/${post.id}`)
      .set('Authorization', await asStudent());

    const response = await request(app)
      .post(`/api/v1/posts/${post.id}/like`)
      .set('Authorization', await asTeacher());

    expect(response.status).toBe(404);
  });
});

describe('comments (FR-SOC-003, 004)', () => {
  it('adds a comment and lists it', async () => {
    const post = await givenPost(await asStudent());

    const created = await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asTeacher())
      .send({ body: 'Well done to everyone.' });

    expect(created.status).toBe(201);
    expect(bodyAs<CommentResponse>(created).mine).toBe(true);

    const list = await request(app)
      .get(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<CommentList>(list).data).toHaveLength(1);
  });

  it('lists chronologically — a conversation reads forwards', async () => {
    const post = await givenPost(await asStudent());

    for (const body of ['First.', 'Second.', 'Third.']) {
      await request(app)
        .post(`/api/v1/posts/${post.id}/comments`)
        .set('Authorization', await asTeacher())
        .send({ body });
    }

    const list = await request(app)
      .get(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<CommentList>(list).data.map((row) => row.body)).toEqual([
      'First.',
      'Second.',
      'Third.',
    ]);
  });

  it('counts comments on the post', async () => {
    const post = await givenPost(await asStudent());

    await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asTeacher())
      .send({ body: 'One.' });

    const read = await request(app)
      .get(`/api/v1/posts/${post.id}`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<PostResponse>(read).commentCount).toBe(1);
  });

  it('refuses an empty comment', async () => {
    const post = await givenPost(await asStudent());

    const response = await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asTeacher())
      .send({ body: '   ' });

    expect(response.status).toBe(422);
  });

  it('lets the comment author delete it, and stops counting it', async () => {
    const post = await givenPost(await asStudent());
    const comment = bodyAs<CommentResponse>(
      await request(app)
        .post(`/api/v1/posts/${post.id}/comments`)
        .set('Authorization', await asTeacher())
        .send({ body: 'Said in haste.' }),
    );

    const response = await request(app)
      .delete(`/api/v1/comments/${comment.id}`)
      .set('Authorization', await asTeacher());

    expect(response.status).toBe(204);

    const read = await request(app)
      .get(`/api/v1/posts/${post.id}`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<PostResponse>(read).commentCount).toBe(0);
    // Soft: moderation still has it.
    expect(await db.postComment.count({ where: { id: comment.id } })).toBe(1);
  });

  /**
   * A real decision, not an oversight. Moderating a thread is a moderation feature (S4-8), and
   * letting an author quietly remove criticism from their own post is the shape of thing this
   * product should not build by accident.
   */
  it('does not let the post’s author delete someone else’s comment', async () => {
    const post = await givenPost(await asStudent());
    const comment = bodyAs<CommentResponse>(
      await request(app)
        .post(`/api/v1/posts/${post.id}/comments`)
        .set('Authorization', await asTeacher())
        .send({ body: 'A criticism.' }),
    );

    const response = await request(app)
      .delete(`/api/v1/comments/${comment.id}`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(403);
  });

  it('refuses commenting on a post the caller cannot see', async () => {
    const post = await givenPost(await asTeacher());
    await block(fixture.studentAccountId, fixture.teacherAccountId);

    const response = await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asStudent())
      .send({ body: 'Shouting into a void.' });

    expect(response.status).toBe(404);
    expect(await db.postComment.count()).toBe(0);
  });

  it('hides a blocked account’s comment from the list', async () => {
    const post = await givenPost(await asStudent());

    await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asTeacher())
      .send({ body: 'From someone the reader blocked.' });
    await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asOutsider())
      .send({ body: 'From someone else.' });

    await block(fixture.studentAccountId, fixture.teacherAccountId);

    const list = await request(app)
      .get(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', await asStudent());

    // The post is the reader's own, so it is still visible; the blocked comment under it is not.
    expect(bodyAs<CommentList>(list).data.map((row) => row.body)).toEqual(['From someone else.']);
  });
});
