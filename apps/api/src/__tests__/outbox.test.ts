/**
 * The transactional outbox — S7-1 (ADR-0019).
 *
 * The guarantee under test is not "events are delivered". It is narrower and worth stating
 * exactly: **a committed domain change always leaves an event behind, and the event survives the
 * queue being unreachable.** Before this table, a failed `queue.add` logged and the notification
 * simply never happened.
 *
 * So the interesting cases here are the failures. A relay against a broken queue must leave every
 * row exactly where it found it, and the same relay against a working one must then deliver them.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAcademicsModule } from '../modules/academics/index.js';
import { createOutboxRepository, createRelay } from '../shared/outbox/index.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { recordingPublisher } from '../shared/events/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';

import type { SchoolFixture } from './support/db.js';
import type { DomainEvent } from '../shared/events/index.js';
import type { Db } from '../shared/db/index.js';

let db: Db;
let fixture: SchoolFixture;

const config = loadConfig();
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

/** Publishes one academic item as the seeded teacher, which is the shortest path to an event. */
async function publishSomething(title = 'Fractions'): Promise<string> {
  const academics = createAcademicsModule({ db, events: recordingPublisher(), logger });

  const item = await academics.service.publish(
    { accountId: fixture.teacherAccountId, accountType: 'INDIVIDUAL', role: 'TEACHER' },
    fixture.classAId,
    { type: 'HOMEWORK', subjectId: fixture.mathsSubjectId, title, body: 'B' },
  );

  return item.id;
}

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
});

afterAll(async () => {
  await closeTestDb();
});

describe('recording', () => {
  it('writes the event in the same transaction as the domain change', async () => {
    const itemId = await publishSomething();

    const rows = await db.outboxEvent.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe('academic.published');
    expect(rows[0]?.publishedAt).toBeNull();
    expect((rows[0]?.payload as { itemId: string }).itemId).toBe(itemId);
  });

  it('leaves no event behind when the domain write is rolled back', async () => {
    // The transaction is the guarantee, so this is the case that proves it is real rather than
    // two writes that happen to run next to each other.
    await expect(
      db.$transaction(async (tx) => {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'academic.published',
            payload: { type: 'academic.published' },
            occurredAt: new Date(),
          },
        });

        throw new Error('the domain write failed');
      }),
    ).rejects.toThrow('the domain write failed');

    expect(await db.outboxEvent.count()).toBe(0);
  });

  /**
   * The previous case proves a transaction rolls back, which Postgres would do anyway. This one
   * proves the *real* write path shares one: if recording the event fails, the academic item must
   * not exist either. Move `recordEvent` outside the repository's transaction and this is the test
   * that notices.
   */
  it('does not create the domain row when its event cannot be recorded', async () => {
    const { createAcademicsRepository } =
      await import('../modules/academics/academics.repository.js');
    const repository = createAcademicsRepository(db);

    await expect(
      repository.create(
        {
          type: 'HOMEWORK',
          classId: fixture.classAId,
          subjectId: fixture.mathsSubjectId,
          authorAccountId: fixture.teacherAccountId,
          title: 'Never happened',
          body: 'B',
        },
        () => {
          throw new Error('the event could not be built');
        },
      ),
    ).rejects.toThrow('the event could not be built');

    expect(await db.academicItem.count({ where: { title: 'Never happened' } })).toBe(0);
    expect(await db.outboxEvent.count()).toBe(0);
  });

  it('carries an envelope the consumer can be idempotent on', async () => {
    await publishSomething();

    const row = await db.outboxEvent.findFirstOrThrow();
    // Through `unknown`: Prisma types a Json column as anything JSON-shaped, including an array,
    // which does not overlap with the event union.
    const payload = row.payload as unknown as DomainEvent;

    // The queue's job id is this, which is what makes a double publish harmless.
    expect(payload.eventId).toBe(row.eventId);
    expect(payload.occurredAt).toBeTruthy();
  });
});

describe('the relay', () => {
  it('hands committed events to the queue and stamps them published', async () => {
    await publishSomething();

    const delivered: DomainEvent[] = [];
    const relay = createRelay({
      repository: createOutboxRepository(db),
      enqueue: (event) => {
        delivered.push(event);
        return Promise.resolve();
      },
      logger,
    });

    expect(await relay.drain()).toBe(1);
    expect(delivered.map((event) => event.type)).toEqual(['academic.published']);

    const row = await db.outboxEvent.findFirstOrThrow();
    expect(row.publishedAt).not.toBeNull();
  });

  it('publishes nothing twice', async () => {
    await publishSomething();

    const delivered: DomainEvent[] = [];
    const relay = createRelay({
      repository: createOutboxRepository(db),
      enqueue: (event) => {
        delivered.push(event);
        return Promise.resolve();
      },
      logger,
    });

    await relay.drain();
    await relay.drain();

    expect(delivered).toHaveLength(1);
  });

  /**
   * The whole point of the table. An unreachable queue used to mean a lost notification; now it
   * means a row that is still there when Redis comes back.
   */
  it('keeps the event when the queue is unreachable, and delivers it once it is not', async () => {
    await publishSomething();

    const repository = createOutboxRepository(db);

    const failing = createRelay({
      repository,
      enqueue: () => Promise.reject(new Error('ECONNREFUSED')),
      logger,
    });

    expect(await failing.drain()).toBe(0);

    const afterFailure = await db.outboxEvent.findFirstOrThrow();
    expect(afterFailure.publishedAt).toBeNull();
    expect(afterFailure.attempts).toBe(1);
    expect(afterFailure.lastError).toContain('ECONNREFUSED');

    const delivered: DomainEvent[] = [];
    const working = createRelay({
      repository,
      enqueue: (event) => {
        delivered.push(event);
        return Promise.resolve();
      },
      logger,
    });

    expect(await working.drain()).toBe(1);
    expect(delivered).toHaveLength(1);
    expect((await db.outboxEvent.findFirstOrThrow()).publishedAt).not.toBeNull();
  });

  it('does not let one bad event strand the rest of the batch', async () => {
    await publishSomething('First');
    await publishSomething('Second');
    await publishSomething('Third');

    const delivered: DomainEvent[] = [];
    const relay = createRelay({
      repository: createOutboxRepository(db),
      enqueue: (event) => {
        if ((event as { title?: string }).title === 'Second') {
          return Promise.reject(new Error('this one is poison'));
        }
        delivered.push(event);
        return Promise.resolve();
      },
      logger,
    });

    expect(await relay.drain()).toBe(2);
    expect(delivered).toHaveLength(2);

    const stuck = await db.outboxEvent.findMany({ where: { publishedAt: null } });
    expect(stuck).toHaveLength(1);
    expect((stuck[0]?.payload as { title: string }).title).toBe('Second');
  });

  it('reports depth, which is the only place a stopped relay is visible', async () => {
    const repository = createOutboxRepository(db);

    await publishSomething('One');
    await publishSomething('Two');

    expect(await repository.depth()).toBe(2);

    await createRelay({ repository, enqueue: () => Promise.resolve(), logger }).drain();

    expect(await repository.depth()).toBe(0);
  });
});

describe('the sweep', () => {
  it('removes published events once they are old enough, and keeps unpublished ones forever', async () => {
    const repository = createOutboxRepository(db);

    await publishSomething('Old');
    await createRelay({ repository, enqueue: () => Promise.resolve(), logger }).drain();

    // Age the published row rather than waiting for it.
    await db.outboxEvent.updateMany({
      data: { publishedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
    });

    await publishSomething('New and unpublished');

    expect(await repository.sweep(new Date(Date.now() - 7 * 24 * 3600 * 1000))).toBe(1);

    const left = await db.outboxEvent.findMany();
    expect(left).toHaveLength(1);
    expect(left[0]?.publishedAt).toBeNull();
  });
});
