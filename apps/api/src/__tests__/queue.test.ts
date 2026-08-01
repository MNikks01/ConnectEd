/**
 * Queue publishing under failure.
 *
 * This exists because of a bug found by testing the degraded path by hand: with Redis
 * unreachable, `queue.add` does not reject — ioredis queues the command while disconnected — so a
 * publish on the request path **hung** until the HTTP client gave up. A verification decision that
 * had already committed appeared to fail.
 *
 * The contract these lock in: publishing is bounded, never throws into the caller, and a failure
 * is logged rather than swallowed.
 */
import { describe, expect, it, vi } from 'vitest';

import { createEventQueue, createRedisConnection } from '../shared/queue/index.js';

import type { Logger } from '../shared/logger/index.js';

/** A port with nothing on it — the honest way to represent "Redis is unreachable". */
const UNREACHABLE = 'redis://127.0.0.1:6399';

function fakeLogger() {
  return { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } as unknown as Logger;
}

describe('publishing when Redis is unreachable', () => {
  it('resolves instead of hanging, within the publish timeout', async () => {
    const connection = createRedisConnection(UNREACHABLE);
    const logger = fakeLogger();
    const { publisher, close } = createEventQueue(connection, logger);

    const started = Date.now();
    await publisher.publish({
      type: 'membership.revoked',
      accountId: '11111111-1111-4111-8111-111111111111',
      schoolId: '22222222-2222-4222-8222-222222222222',
    });
    const elapsed = Date.now() - started;

    // Bounded by the 2s publish timeout, with headroom for a slow machine.
    expect(elapsed).toBeLessThan(5000);

    await close().catch(() => undefined);
    connection.disconnect();
  });

  it('does not throw into the caller — the domain change already committed', async () => {
    const connection = createRedisConnection(UNREACHABLE);
    const { publisher, close } = createEventQueue(connection, fakeLogger());

    await expect(
      publisher.publish({
        type: 'membership.revoked',
        accountId: '11111111-1111-4111-8111-111111111111',
        schoolId: '22222222-2222-4222-8222-222222222222',
      }),
    ).resolves.toBeUndefined();

    await close().catch(() => undefined);
    connection.disconnect();
  });

  it('logs the failure rather than losing the event silently', async () => {
    const connection = createRedisConnection(UNREACHABLE);
    const logger = fakeLogger();
    const { publisher, close } = createEventQueue(connection, logger);

    await publisher.publish({
      type: 'membership.revoked',
      accountId: '11111111-1111-4111-8111-111111111111',
      schoolId: '22222222-2222-4222-8222-222222222222',
    });

    expect(logger.error).toHaveBeenCalledTimes(1);

    await close().catch(() => undefined);
    connection.disconnect();
  });
});
