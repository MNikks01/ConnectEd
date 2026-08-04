/**
 * The feed — S4-6 (FR-SOC-012).
 *
 * The sprint plan called this "the first unbounded read across accounts" and said the risk was the
 * query rather than the contract. So these tests hold two things: that the right posts appear, and
 * that the feed is assembled by **one** query whose cost does not grow with how many accounts the
 * caller follows.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaClient } from '../generated/prisma/client.js';
import { createPostRepository } from '../modules/social/post.repository.js';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { PostResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

interface Feed {
  data: PostResponse[];
  nextCursor: string | null;
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
const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER');

async function givenPost(authorization: string, body: string): Promise<PostResponse> {
  const response = await request(app)
    .post('/api/v1/posts')
    .set('Authorization', authorization)
    .send({ body });

  expect(response.status, `setup: publishing failed — ${response.text}`).toBe(201);
  return bodyAs<PostResponse>(response);
}

async function follow(follower: string, followee: string): Promise<void> {
  await db.follow.create({ data: { followerAccountId: follower, followeeAccountId: followee } });
}

async function connect(a: string, b: string): Promise<void> {
  const [first, second] = a < b ? [a, b] : [b, a];
  await db.connection.create({
    data: { aAccountId: first, bAccountId: second, status: 'ACCEPTED', requestedBy: a },
  });
}

async function feedFor(authorization: string, query = ''): Promise<Feed> {
  const response = await request(app)
    .get(`/api/v1/feed${query}`)
    .set('Authorization', authorization);

  expect(response.status).toBe(200);
  return bodyAs<Feed>(response);
}

describe('what the feed contains (FR-SOC-012)', () => {
  it('includes posts from accounts the caller follows', async () => {
    await follow(fixture.studentAccountId, fixture.teacherAccountId);
    await givenPost(await asTeacher(), 'From someone followed.');

    expect((await feedFor(await asStudent())).data.map((row) => row.body)).toEqual([
      'From someone followed.',
    ]);
  });

  it('includes posts from accepted connections', async () => {
    await connect(fixture.studentAccountId, fixture.teacherAccountId);
    await givenPost(await asTeacher(), 'From a connection.');

    expect((await feedFor(await asStudent())).data.map((row) => row.body)).toEqual([
      'From a connection.',
    ]);
  });

  it('includes the caller’s own posts', async () => {
    await givenPost(await asStudent(), 'Mine.');

    // Not in the PRD's wording, but a feed that hides what you just wrote reads as a bug to
    // everyone who has used any other product.
    expect((await feedFor(await asStudent())).data.map((row) => row.body)).toEqual(['Mine.']);
  });

  it('excludes an account the caller has no relationship with', async () => {
    await givenPost(await asOutsider(), 'From a stranger.');

    expect((await feedFor(await asStudent())).data).toHaveLength(0);
  });

  it('ignores a connection that is still pending', async () => {
    const [a, b] =
      fixture.studentAccountId < fixture.teacherAccountId
        ? [fixture.studentAccountId, fixture.teacherAccountId]
        : [fixture.teacherAccountId, fixture.studentAccountId];

    await db.connection.create({
      data: {
        aAccountId: a,
        bAccountId: b,
        status: 'PENDING',
        requestedBy: fixture.studentAccountId,
      },
    });
    await givenPost(await asTeacher(), 'Not yet connected.');

    expect((await feedFor(await asStudent())).data).toHaveLength(0);
  });

  it('follows a school as readily as a person', async () => {
    await follow(fixture.outsiderAccountId, fixture.schoolAccountId);
    await givenPost(await asSchool(), 'From the school.');

    expect((await feedFor(await asOutsider())).data).toHaveLength(1);
  });

  it('does not duplicate a post from someone both followed and connected', async () => {
    await follow(fixture.studentAccountId, fixture.teacherAccountId);
    await connect(fixture.studentAccountId, fixture.teacherAccountId);
    await givenPost(await asTeacher(), 'Once, please.');

    // An OR across relationships, not a union of separate queries — otherwise this is two rows.
    expect((await feedFor(await asStudent())).data).toHaveLength(1);
  });

  it('drops a post once its author deletes it', async () => {
    await follow(fixture.studentAccountId, fixture.teacherAccountId);
    const post = await givenPost(await asTeacher(), 'Retracted.');

    await request(app)
      .delete(`/api/v1/posts/${post.id}`)
      .set('Authorization', await asTeacher());

    expect((await feedFor(await asStudent())).data).toHaveLength(0);
  });

  it('drops a followed account’s posts when either side blocks', async () => {
    await follow(fixture.studentAccountId, fixture.teacherAccountId);
    await givenPost(await asTeacher(), 'Before the block.');

    await db.block.create({
      data: {
        blockerAccountId: fixture.teacherAccountId,
        blockedAccountId: fixture.studentAccountId,
      },
    });

    // The follow row survives; the content does not.
    expect((await feedFor(await asStudent())).data).toHaveLength(0);
  });
});

describe('ordering and pagination', () => {
  it('is reverse-chronological', async () => {
    await follow(fixture.studentAccountId, fixture.teacherAccountId);

    for (const body of ['Oldest.', 'Middle.', 'Newest.']) {
      await givenPost(await asTeacher(), body);
    }

    expect((await feedFor(await asStudent())).data.map((row) => row.body)).toEqual([
      'Newest.',
      'Middle.',
      'Oldest.',
    ]);
  });

  it('pages with a cursor, without repeating or skipping', async () => {
    await follow(fixture.studentAccountId, fixture.teacherAccountId);

    for (let i = 0; i < 5; i += 1) {
      await givenPost(await asTeacher(), `Post ${i}.`);
    }

    const first = await feedFor(await asStudent(), '?limit=2');
    expect(first.data).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = await feedFor(
      await asStudent(),
      `?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );

    const seen = [...first.data, ...second.data].map((row) => row.body);
    expect(seen).toEqual(['Post 4.', 'Post 3.', 'Post 2.', 'Post 1.']);
    expect(new Set(seen).size).toBe(4);
  });

  it('ends with a null cursor rather than looping', async () => {
    await follow(fixture.studentAccountId, fixture.teacherAccountId);
    await givenPost(await asTeacher(), 'The only one.');

    expect((await feedFor(await asStudent(), '?limit=20')).nextCursor).toBeNull();
  });
});

describe('the cost of the feed', () => {
  /**
   * The risk the sprint plan named: a feed assembled with one query per followed account is fine
   * in a test and useless at a hundred follows. This asserts the shape of the implementation, not
   * only its output — the statement count must not move when the number of follows does.
   *
   * It needs its own client, because counting statements requires `log: ['query']` and the shared
   * test client does not have it. The repository is called directly for the same reason: the
   * question is what the feed query costs, not what an HTTP round trip costs.
   */
  it('costs the same whether the caller follows one account or twenty', async () => {
    const connectionString = process.env.DATABASE_URL ?? '';
    const counting = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
      log: [{ emit: 'event', level: 'query' }],
    });

    let statements = 0;
    counting.$on('query', () => {
      statements += 1;
    });

    const repository = createPostRepository(counting);
    const page = { limit: 20, after: undefined };

    await follow(fixture.studentAccountId, fixture.teacherAccountId);
    await givenPost(await asTeacher(), 'One.');

    statements = 0;
    await repository.listFeed(fixture.studentAccountId, page);
    const withOne = statements;

    for (let i = 0; i < 19; i += 1) {
      const extra = await db.account.create({
        data: {
          email: `feed-author-${i}-${Date.now()}@fixture.test`,
          type: 'INDIVIDUAL',
          userProfile: {
            create: {
              fullName: `Author ${i}`,
              handle: `feedauthor${i}${Date.now()}`,
              role: 'USER',
            },
          },
        },
        select: { id: true },
      });

      await follow(fixture.studentAccountId, extra.id);
      await db.post.create({ data: { authorAccountId: extra.id, body: `From author ${i}.` } });
    }

    statements = 0;
    const feed = await repository.listFeed(fixture.studentAccountId, page);
    const withTwenty = statements;

    await counting.$disconnect();

    // Guards against a vacuous pass: if the listener never fired, both counts would be zero and
    // the comparison below would mean nothing. It fired zero times on the first attempt at this
    // test, which is exactly why the guard is here.
    expect(withOne).toBeGreaterThan(0);
    expect(feed).toHaveLength(20);

    // Not "fast" — *flat*. This catches a per-follow N+1, which is the shape that makes a feed
    // useless at a hundred follows. It deliberately does **not** catch the other rejected shape,
    // fetching the follow ids first and passing them in an `IN` list: that is a constant two
    // queries, and its problem is silent truncation past the id cap rather than cost. The
    // repository comment covers that one; this test covers this one.
    expect(withTwenty).toBe(withOne);
  });
});
