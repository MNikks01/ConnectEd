/**
 * Real-time delivery — S5-11 (FR-SOC-022, ADR-0016).
 *
 * Against a real Redis and a real HTTP server, because everything worth asserting here is at a
 * seam: the upgrade handshake, a ticket that must not survive its first use, and a payload that
 * must cross a pub/sub channel to reach a socket held by *another* process.
 *
 * The two claims that matter most are negative ones. **A ticket is single-use**, so one leaked
 * into a URL bar buys nothing. And **the payload carries no message body**, so a socket opened
 * before a block cannot keep delivering content afterwards — the client is told a thread moved and
 * has to come back through an endpoint that authorizes the read.
 */
import { createServer, type Server } from 'node:http';

import { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { createRealtime, REALTIME_PATH, type Realtime } from '../shared/realtime/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

let db: Db;
let app: Express;
let server: Server;
let otherServer: Server;
let port: number;
let otherPort: number;
let fixture: SchoolFixture;

let realtime: Realtime;
let redis: Redis;
let subscriber: Redis;
/** A second channel over the same Redis, standing in for another replica. */
let otherReplica: Realtime;
let otherRedis: Redis;
let otherSubscriber: Redis;

const sockets: WebSocket[] = [];

function connection(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false });
}

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();

  redis = connection(config.REDIS_URL);
  subscriber = connection(config.REDIS_URL);
  otherRedis = connection(config.REDIS_URL);
  otherSubscriber = connection(config.REDIS_URL);

  realtime = createRealtime({ redis, subscriber, logger });
  otherReplica = createRealtime({ redis: otherRedis, subscriber: otherSubscriber, logger });

  // Two HTTP servers, one per channel. Attaching both to a single server would have them race
  // for every upgrade and spend each other's tickets — which is a property of the test rig, not
  // of the code, and would have looked exactly like a delivery bug.
  app = createApp({ db, config, realtime });
  server = createServer(app);
  realtime.attach(server);

  otherServer = createServer(createApp({ db, config, realtime: otherReplica }));
  otherReplica.attach(otherServer);

  await Promise.all([
    new Promise<void>((resolve) => {
      server.listen(0, resolve);
    }),
    new Promise<void>((resolve) => {
      otherServer.listen(0, resolve);
    }),
  ]);

  port = portOf(server);
  otherPort = portOf(otherServer);
});

function portOf(target: Server): number {
  const address = target.address();
  return typeof address === 'object' && address ? address.port : 0;
}

afterAll(async () => {
  await realtime.close();
  await otherReplica.close();
  await Promise.all([
    new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      otherServer.close(() => {
        resolve();
      });
    }),
  ]);
  redis.disconnect();
  subscriber.disconnect();
  otherRedis.disconnect();
  otherSubscriber.disconnect();
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
});

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close();
});

async function auth(accountId: string) {
  const token = await tokens.signAccessToken({ sub: accountId, accountType: 'INDIVIDUAL' });
  return `Bearer ${token}`;
}

async function ticketFor(accountId: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/me/realtime-ticket')
    .set('Authorization', await auth(accountId));

  expect(response.status, `ticket request failed — ${response.text}`).toBe(201);
  return bodyAs<{ ticket: string }>(response).ticket;
}

/** Opens a socket and resolves once the server has accepted it. */
async function connect(ticket: string): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${String(port)}${REALTIME_PATH}?ticket=${ticket}`);
  sockets.push(socket);

  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  return socket;
}

/** The next frame, or a rejection — never a hang, because a hang reads as a slow test. */
function nextEvent(socket: WebSocket, timeoutMs = 3000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`no realtime event within ${String(timeoutMs)}ms`));
    }, timeoutMs);

    socket.once('message', (raw: Buffer) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString()));
    });
  });
}

async function threadBetween(a: string, b: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/threads')
    .set('Authorization', await auth(a))
    .send({ accountId: b });

  expect([200, 201], `thread setup failed — ${response.text}`).toContain(response.status);
  return bodyAs<{ id: string }>(response).id;
}

describe('tickets', () => {
  it('issues one to an authenticated caller', async () => {
    const response = await request(app)
      .post('/api/v1/me/realtime-ticket')
      .set('Authorization', await auth(fixture.studentAccountId));

    expect(response.status).toBe(201);
    expect(bodyAs<{ ticket: string; expiresInSeconds: number }>(response).expiresInSeconds).toBe(
      30,
    );
  });

  it('refuses an unauthenticated caller', async () => {
    const response = await request(app).post('/api/v1/me/realtime-ticket');

    expect(response.status).toBe(401);
  });

  it('says nothing about the account it belongs to', async () => {
    const ticket = await ticketFor(fixture.studentAccountId);

    // The ticket is a key into Redis, not an encoding of anything. One found in a proxy log is not
    // even an account identifier.
    expect(ticket).not.toContain(fixture.studentAccountId);
    expect(Buffer.from(ticket, 'base64url').toString('hex')).not.toContain(
      fixture.studentAccountId.replace(/-/g, ''),
    );
  });

  it('is spent by the first connection', async () => {
    const ticket = await ticketFor(fixture.studentAccountId);
    await connect(ticket);

    // The reuse is the attack: a ticket that survived would make a URL in someone's history a
    // durable credential.
    await expect(connect(ticket)).rejects.toThrow(/401/);
  });

  it('refuses an upgrade with no ticket at all', async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${String(port)}${REALTIME_PATH}`);
    sockets.push(socket);

    await expect(
      new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      }),
    ).rejects.toThrow(/401/);
  });

  it('refuses a ticket somebody made up', async () => {
    await expect(connect('not-a-real-ticket')).rejects.toThrow(/401/);
  });
});

describe('delivery', () => {
  it('reaches the recipient when a message is sent', async () => {
    const threadId = await threadBetween(fixture.studentAccountId, fixture.teacherAccountId);
    const socket = await connect(await ticketFor(fixture.teacherAccountId));

    const delivered = nextEvent(socket);

    await request(app)
      .post(`/api/v1/threads/${threadId}/messages`)
      .set('Authorization', await auth(fixture.studentAccountId))
      .send({ body: 'Is this live?' });

    expect(await delivered).toEqual({ type: 'message.created', threadId });
  });

  it('never carries the message itself', async () => {
    const threadId = await threadBetween(fixture.studentAccountId, fixture.teacherAccountId);
    const socket = await connect(await ticketFor(fixture.teacherAccountId));

    const delivered = nextEvent(socket);

    await request(app)
      .post(`/api/v1/threads/${threadId}/messages`)
      .set('Authorization', await auth(fixture.studentAccountId))
      .send({ body: 'Something private.' });

    // The channel is a hint, not a read path. A body here would be a second way to see a message
    // with its own authorization to get wrong — and would keep delivering to a socket opened
    // before the sender was blocked.
    expect(JSON.stringify(await delivered)).not.toContain('Something private');
  });

  it('does not tell the sender about their own message', async () => {
    const threadId = await threadBetween(fixture.studentAccountId, fixture.teacherAccountId);
    const socket = await connect(await ticketFor(fixture.studentAccountId));

    await request(app)
      .post(`/api/v1/threads/${threadId}/messages`)
      .set('Authorization', await auth(fixture.studentAccountId))
      .send({ body: 'To myself?' });

    // The sender already has the message in their response. A frame here would make every client
    // render it twice.
    await expect(nextEvent(socket, 500)).rejects.toThrow(/no realtime event/);
  });

  it('tells nobody else', async () => {
    const threadId = await threadBetween(fixture.studentAccountId, fixture.teacherAccountId);
    const bystander = await connect(await ticketFor(fixture.outsiderAccountId));

    await request(app)
      .post(`/api/v1/threads/${threadId}/messages`)
      .set('Authorization', await auth(fixture.studentAccountId))
      .send({ body: 'Not for you.' });

    await expect(nextEvent(bystander, 500)).rejects.toThrow(/no realtime event/);
  });

  it('crosses replicas', async () => {
    const threadId = await threadBetween(fixture.studentAccountId, fixture.teacherAccountId);

    // Connected to the *other* server — its own Redis connections and its own socket table, which
    // is what a second pod is. The ticket was issued by the first one.
    const ticket = await ticketFor(fixture.teacherAccountId);
    const socket = new WebSocket(
      `ws://127.0.0.1:${String(otherPort)}${REALTIME_PATH}?ticket=${ticket}`,
    );
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    const delivered = nextEvent(socket);

    await request(app)
      .post(`/api/v1/threads/${threadId}/messages`)
      .set('Authorization', await auth(fixture.studentAccountId))
      .send({ body: 'Across the wire.' });

    // If this needed sticky sessions it would fail here, and it would fail only in production.
    expect(await delivered).toMatchObject({ type: 'message.created' });
  });

  it('reaches every tab the same person has open', async () => {
    const threadId = await threadBetween(fixture.studentAccountId, fixture.teacherAccountId);
    const first = await connect(await ticketFor(fixture.teacherAccountId));
    const second = await connect(await ticketFor(fixture.teacherAccountId));

    const both = Promise.all([nextEvent(first), nextEvent(second)]);

    await request(app)
      .post(`/api/v1/threads/${threadId}/messages`)
      .set('Authorization', await auth(fixture.studentAccountId))
      .send({ body: 'Twice over.' });

    expect(await both).toHaveLength(2);
  });

  it('still delivers the message when the channel is absent', async () => {
    // An API built without realtime — which is every other test file, and a deployment without
    // Redis. Messaging must not depend on the optimisation.
    const plain = createApp({ db, config });
    const threadId = await threadBetween(fixture.studentAccountId, fixture.teacherAccountId);

    const response = await request(plain)
      .post(`/api/v1/threads/${threadId}/messages`)
      .set('Authorization', await auth(fixture.studentAccountId))
      .send({ body: 'No sockets here.' });

    expect(response.status).toBe(201);
  });
});

describe('connection bookkeeping', () => {
  it('forgets a socket when it closes', async () => {
    const socket = await connect(await ticketFor(fixture.studentAccountId));
    expect(realtime.localConnections() + otherReplica.localConnections()).toBeGreaterThan(0);

    await new Promise<void>((resolve) => {
      socket.once('close', () => {
        resolve();
      });
      socket.close();
    });

    // Given a moment for the server's own close handler to run.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(realtime.localConnections() + otherReplica.localConnections()).toBe(0);
  });
});
