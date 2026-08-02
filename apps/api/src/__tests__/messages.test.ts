/**
 * Direct messages — S4-7 (FR-SOC-020, 021).
 *
 * The only place in social where content is addressed to a person rather than published, which
 * changes what blocking has to do: a blocked account must not reach the person who blocked them,
 * and an existing thread with them must leave the inbox — including its contribution to the badge.
 *
 * The sprint plan also warned that per-message read state is where an N+1 hides. There is a test
 * for the inbox's query count, not only for its contents.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { createMessageRepository } from '../modules/social/message.repository.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { InboxResponse, MessageResponse, ThreadResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

interface MessagePage {
  data: MessageResponse[];
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

async function startThread(authorization: string, accountId: string): Promise<ThreadResponse> {
  const response = await request(app)
    .post('/api/v1/threads')
    .set('Authorization', authorization)
    .send({ accountId });

  expect(response.status, `setup: starting the thread failed — ${response.text}`).toBe(200);
  return bodyAs<ThreadResponse>(response);
}

async function send(authorization: string, threadId: string, body: string): Promise<void> {
  const response = await request(app)
    .post(`/api/v1/threads/${threadId}/messages`)
    .set('Authorization', authorization)
    .send({ body });

  expect(response.status, `setup: sending failed — ${response.text}`).toBe(201);
}

async function block(blocker: string, blocked: string): Promise<void> {
  await db.block.create({ data: { blockerAccountId: blocker, blockedAccountId: blocked } });
}

describe('threads (FR-SOC-020)', () => {
  it('starts a thread, and starting it again returns the same one', async () => {
    const first = await startThread(await asStudent(), fixture.teacherAccountId);
    const second = await startThread(await asStudent(), fixture.teacherAccountId);

    expect(second.id).toBe(first.id);
    expect(await db.messageThread.count()).toBe(1);
  });

  it('finds the same thread from either side', async () => {
    const fromStudent = await startThread(await asStudent(), fixture.teacherAccountId);
    const fromTeacher = await startThread(await asTeacher(), fixture.studentAccountId);

    // Participants are stored in a fixed order, so a pair has one thread however it started.
    expect(fromTeacher.id).toBe(fromStudent.id);
  });

  it('names the other participant, not the caller', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);

    expect(thread.other.accountId).toBe(fixture.teacherAccountId);
  });

  it('gives a school an inbox like anyone else', async () => {
    const thread = await startThread(await asOutsider(), fixture.schoolAccountId);
    await send(await asOutsider(), thread.id, 'Do you have places for September?');

    const inbox = bodyAs<InboxResponse>(
      await request(app)
        .get('/api/v1/threads')
        .set('Authorization', await asSchool()),
    );

    expect(inbox.data).toHaveLength(1);
    expect(inbox.unreadTotal).toBe(1);
  });

  it('refuses a thread with yourself', async () => {
    const response = await request(app)
      .post('/api/v1/threads')
      .set('Authorization', await asStudent())
      .send({ accountId: fixture.studentAccountId });

    expect(response.status).toBe(404);
  });

  it('refuses a thread with someone who blocked you', async () => {
    await block(fixture.teacherAccountId, fixture.studentAccountId);

    const response = await request(app)
      .post('/api/v1/threads')
      .set('Authorization', await asStudent())
      .send({ accountId: fixture.teacherAccountId });

    expect(response.status).toBe(404);
    expect(await db.messageThread.count()).toBe(0);
  });
});

describe('sending and reading (FR-SOC-020, 021)', () => {
  it('sends, and the recipient sees it unread', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);
    await send(await asStudent(), thread.id, 'Could we talk about the homework?');

    const inbox = bodyAs<InboxResponse>(
      await request(app)
        .get('/api/v1/threads')
        .set('Authorization', await asTeacher()),
    );

    expect(inbox.unreadTotal).toBe(1);
    expect(inbox.data[0]?.unreadCount).toBe(1);
    expect(inbox.data[0]?.lastMessage).toMatchObject({
      body: 'Could we talk about the homework?',
      mine: false,
    });
  });

  it('does not count your own messages as unread', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);
    await send(await asStudent(), thread.id, 'Mine.');

    const inbox = bodyAs<InboxResponse>(
      await request(app)
        .get('/api/v1/threads')
        .set('Authorization', await asStudent()),
    );

    expect(inbox.unreadTotal).toBe(0);
    expect(inbox.data[0]?.lastMessage?.mine).toBe(true);
  });

  it('clears unread when the recipient reads the thread', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);
    await send(await asStudent(), thread.id, 'One.');
    await send(await asStudent(), thread.id, 'Two.');

    await request(app)
      .get(`/api/v1/threads/${thread.id}/messages`)
      .set('Authorization', await asTeacher());

    const inbox = bodyAs<InboxResponse>(
      await request(app)
        .get('/api/v1/threads')
        .set('Authorization', await asTeacher()),
    );

    // Opening the thread is the read — there is no button to forget to press.
    expect(inbox.unreadTotal).toBe(0);
  });

  it('does not mark the sender’s own messages read on their behalf', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);
    await send(await asStudent(), thread.id, 'Waiting for a reply.');

    await request(app)
      .get(`/api/v1/threads/${thread.id}/messages`)
      .set('Authorization', await asStudent());

    const messages = bodyAs<MessagePage>(
      await request(app)
        .get(`/api/v1/threads/${thread.id}/messages`)
        .set('Authorization', await asStudent()),
    );

    // "Read" means the *other* party read it, which is what a read receipt is for.
    expect(messages.data[0]?.readAt).toBeNull();
  });

  it('shows a read receipt to the sender once the recipient has read it', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);
    await send(await asStudent(), thread.id, 'Please read.');

    await request(app)
      .get(`/api/v1/threads/${thread.id}/messages`)
      .set('Authorization', await asTeacher());

    const messages = bodyAs<MessagePage>(
      await request(app)
        .get(`/api/v1/threads/${thread.id}/messages`)
        .set('Authorization', await asStudent()),
    );

    expect(messages.data[0]?.readAt).toEqual(expect.any(String));
  });

  it('orders messages newest first and pages with a cursor', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);

    for (const body of ['One.', 'Two.', 'Three.']) {
      await send(await asStudent(), thread.id, body);
    }

    const first = bodyAs<MessagePage>(
      await request(app)
        .get(`/api/v1/threads/${thread.id}/messages?limit=2`)
        .set('Authorization', await asTeacher()),
    );

    const second = bodyAs<MessagePage>(
      await request(app)
        .get(
          `/api/v1/threads/${thread.id}/messages?limit=2&cursor=${encodeURIComponent(
            first.nextCursor ?? '',
          )}`,
        )
        .set('Authorization', await asTeacher()),
    );

    expect([...first.data, ...second.data].map((row) => row.body)).toEqual([
      'Three.',
      'Two.',
      'One.',
    ]);
  });

  it('refuses a stranger reading a thread they are not in', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);
    await send(await asStudent(), thread.id, 'Private.');

    const response = await request(app)
      .get(`/api/v1/threads/${thread.id}/messages`)
      .set('Authorization', await asOutsider());

    // 404: thread ids are opaque, and confirming one exists says something about two other people.
    expect(response.status).toBe(404);
  });

  it('refuses a stranger sending into a thread they are not in', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);

    const response = await request(app)
      .post(`/api/v1/threads/${thread.id}/messages`)
      .set('Authorization', await asOutsider())
      .send({ body: 'Butting in.' });

    expect(response.status).toBe(404);
    expect(await db.message.count()).toBe(0);
  });

  it('rejects an empty message', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);

    const response = await request(app)
      .post(`/api/v1/threads/${thread.id}/messages`)
      .set('Authorization', await asStudent())
      .send({ body: '   ' });

    expect(response.status).toBe(422);
  });
});

describe('blocking', () => {
  it('stops a blocked account sending into an existing thread', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);
    await send(await asStudent(), thread.id, 'Before.');

    await block(fixture.teacherAccountId, fixture.studentAccountId);

    const response = await request(app)
      .post(`/api/v1/threads/${thread.id}/messages`)
      .set('Authorization', await asStudent())
      .send({ body: 'After.' });

    expect(response.status).toBe(404);
    expect(await db.message.count()).toBe(1);
  });

  it('takes the thread out of both inboxes, and out of the badge', async () => {
    const thread = await startThread(await asStudent(), fixture.teacherAccountId);
    await send(await asStudent(), thread.id, 'Unread when the block lands.');

    await block(fixture.teacherAccountId, fixture.studentAccountId);

    const blocker = bodyAs<InboxResponse>(
      await request(app)
        .get('/api/v1/threads')
        .set('Authorization', await asTeacher()),
    );
    const blocked = bodyAs<InboxResponse>(
      await request(app)
        .get('/api/v1/threads')
        .set('Authorization', await asStudent()),
    );

    expect(blocker.data).toHaveLength(0);
    // The unread badge must not keep pointing at a conversation neither party can open.
    expect(blocker.unreadTotal).toBe(0);
    expect(blocked.data).toHaveLength(0);
  });
});

describe('the cost of the inbox', () => {
  /**
   * The sprint plan flagged per-message read state as the same N+1 shape the class feed hit. An
   * inbox needs, per thread, the other participant, the last message and an unread count — three
   * lookups each if written naively. This asserts the statement count does not move with the
   * number of threads.
   */
  it('costs the same for one thread as for ten', async () => {
    const connectionString = process.env.DATABASE_URL ?? '';
    const counting = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
      log: [{ emit: 'event', level: 'query' }],
    });

    let statements = 0;
    counting.$on('query', () => {
      statements += 1;
    });

    const repository = createMessageRepository(counting);

    const first = await startThread(await asStudent(), fixture.teacherAccountId);
    await send(await asTeacher(), first.id, 'Hello.');

    statements = 0;
    await repository.listInbox(fixture.studentAccountId);
    const withOne = statements;

    for (let i = 0; i < 9; i += 1) {
      const other = await db.account.create({
        data: {
          email: `inbox-${i}-${Date.now()}@fixture.test`,
          type: 'INDIVIDUAL',
          userProfile: {
            create: { fullName: `Sender ${i}`, handle: `inbox${i}${Date.now()}`, role: 'USER' },
          },
        },
        select: { id: true },
      });

      const thread = await startThread(await asStudent(), other.id);
      await db.message.create({
        data: { threadId: thread.id, senderAccountId: other.id, body: `Message ${i}.` },
      });
    }

    statements = 0;
    const inbox = await repository.listInbox(fixture.studentAccountId);
    const withTen = statements;

    await counting.$disconnect();

    // Guards against a vacuous pass, as the feed's equivalent test learned to.
    expect(withOne).toBeGreaterThan(0);
    expect(inbox).toHaveLength(10);
    expect(withTen).toBe(withOne);
  });
});
