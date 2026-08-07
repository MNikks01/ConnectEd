/**
 * Enqueuing when Redis is unreachable.
 *
 * This file exists because of a bug found by testing the degraded path by hand: with Redis
 * unreachable, `queue.add` does **not** reject — ioredis queues the command while disconnected —
 * so a publish on the request path *hung* until the HTTP client gave up. A verification decision
 * that had already committed appeared to fail.
 *
 * The publisher those tests covered is gone (ADR-0019, S7-2), but the hazard is not, and its new
 * home is worse: the outbox relay is a loop, and an unbounded `add` would hang a pass and with it
 * the relay's shutdown. So the contract is inverted rather than deleted. It used to be "never
 * throws, and the event is lost". It is now **"fails within the timeout, and the event stays in
 * the outbox"** — which is only safe because something is holding the event on the caller's
 * behalf.
 */
import { describe, expect, it, vi } from 'vitest';

import { createEventQueue, createRedisConnection } from '../shared/queue/index.js';
import { createRelay } from '../shared/outbox/index.js';

import type { Logger } from '../shared/logger/index.js';
import type { OutboxRepository, OutboxRow } from '../shared/outbox/index.js';

/** A port with nothing on it — the honest way to represent "Redis is unreachable". */
const UNREACHABLE = 'redis://127.0.0.1:6399';

function fakeLogger() {
  return { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } as unknown as Logger;
}

const anEvent = {
  type: 'membership.revoked' as const,
  eventId: '33333333-3333-4333-8333-333333333333',
  occurredAt: new Date().toISOString(),
  accountId: '11111111-1111-4111-8111-111111111111',
  schoolId: '22222222-2222-4222-8222-222222222222',
};

describe('enqueuing when Redis is unreachable', () => {
  it('rejects instead of hanging, within the publish timeout', async () => {
    const connection = createRedisConnection(UNREACHABLE);
    const { enqueue, close } = createEventQueue(connection);

    const started = Date.now();
    await expect(enqueue(anEvent)).rejects.toThrow(/timed out/);
    const elapsed = Date.now() - started;

    // Bounded by the 2s publish timeout, with headroom for a slow machine.
    expect(elapsed).toBeLessThan(5000);

    await close().catch(() => undefined);
    connection.disconnect();
  });

  /**
   * The inversion, stated as a test. A throw here is not a regression — it is the mechanism by
   * which the row survives. Swallowing it would put the event back in the bin the outbox exists
   * to keep it out of.
   */
  it('leaves the event unpublished rather than losing it', async () => {
    const connection = createRedisConnection(UNREACHABLE);
    const { enqueue, close } = createEventQueue(connection);

    const rows: OutboxRow[] = [
      { id: 'row-1', eventId: anEvent.eventId, attempts: 0, payload: anEvent },
    ];
    const marked = { published: [] as string[], failed: [] as string[] };

    const repository: OutboxRepository = {
      claim: () => Promise.resolve(rows),
      markPublished: (ids) => {
        marked.published.push(...ids);
        return Promise.resolve();
      },
      markFailed: (id) => {
        marked.failed.push(id);
        return Promise.resolve();
      },
      depth: () => Promise.resolve(rows.length),
      sweep: () => Promise.resolve(0),
    };

    const relay = createRelay({ repository, enqueue, logger: fakeLogger() });

    expect(await relay.drain()).toBe(0);
    expect(marked.published).toEqual([]);
    expect(marked.failed).toEqual(['row-1']);

    await close().catch(() => undefined);
    connection.disconnect();
  });
});
