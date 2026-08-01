/**
 * BullMQ queue and worker (ADR-0008).
 *
 * One queue for domain events. Splitting per event type buys nothing until throughput demands it,
 * and costs a connection and a worker each.
 *
 * Retries use exponential backoff and leave failures on the queue rather than discarding them
 * (`.docs/PRD/07-notifications.md` FR-NOTIF-005: "retried with backoff; dead-letter after N").
 * BullMQ keeps exhausted jobs in a failed set, which is the dead-letter queue — it is only useful
 * if someone watches it, so `queue_jobs_failed` is exported for alerting.
 */
import { Queue, Worker, type ConnectionOptions, type Processor } from 'bullmq';
import { Redis } from 'ioredis';

import {
  envelope,
  type DomainEvent,
  type EventPublisher,
  type PublishableEvent,
} from '../events/index.js';

import type { Logger } from '../logger/index.js';

export const EVENTS_QUEUE = 'domain-events';

/**
 * How long a publish may take before it is abandoned. Short: this runs on the request path, after
 * the work the caller asked for has already been committed.
 */
const PUBLISH_TIMEOUT_MS = 2000;

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * BullMQ requires `maxRetriesPerRequest: null` on its connection — with the ioredis default, a
 * blocking command that outlives the retry budget throws and the worker stops consuming silently.
 */
export function createRedisConnection(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}

export interface QueueBundle {
  queue: Queue;
  publisher: EventPublisher;
  close: () => Promise<void>;
  /** Readiness probe target — a queue that cannot reach Redis is not ready to serve. */
  ping: () => Promise<void>;
}

export function createEventQueue(connection: Redis, logger: Logger): QueueBundle {
  const queue = new Queue(EVENTS_QUEUE, {
    connection: connection as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      // Keep a window of history for debugging without letting Redis grow without bound.
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  });

  const publisher: EventPublisher = {
    publish: async (event: PublishableEvent) => {
      const full = envelope(event);

      try {
        // Bounded on purpose. ioredis queues commands while disconnected rather than rejecting
        // them, so `queue.add` against an unreachable Redis does not fail — it waits for a
        // reconnection that may never come, and the HTTP request hangs until the client times
        // out. A caller who has already committed their transaction must not be held up by the
        // queue at all, so a slow publish is treated exactly like a failed one.
        await withTimeout(queue.add(full.type, full, { jobId: full.eventId }), PUBLISH_TIMEOUT_MS);
      } catch (error) {
        // The domain change already committed; failing the caller now would report an error for
        // something that succeeded. The event is lost, which is why this logs at error level.
        logger.error({ err: error, type: full.type }, 'Failed to publish domain event');
      }
    },
  };

  return {
    queue,
    publisher,
    ping: async () => {
      await connection.ping();
    },
    close: async () => {
      await queue.close();
    },
  };
}

export interface WorkerBundle {
  worker: Worker;
  close: () => Promise<void>;
}

export function createEventWorker(
  connection: Redis,
  logger: Logger,
  handle: (event: DomainEvent) => Promise<void>,
): WorkerBundle {
  const processor: Processor = async (job) => {
    await handle(job.data as DomainEvent);
  };

  const worker = new Worker(EVENTS_QUEUE, processor, {
    connection: connection as unknown as ConnectionOptions,
    concurrency: 5,
  });

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, attempts: job?.attemptsMade, err: error },
      'Domain event handler failed',
    );
  });

  return {
    worker,
    close: async () => {
      await worker.close();
    },
  };
}
