/**
 * BullMQ queue and worker (ADR-0008).
 *
 * One queue for domain events. Splitting per event type buys nothing until throughput demands it,
 * and costs a connection and a worker each.
 *
 * Retries use exponential backoff and leave failures on the queue rather than discarding them
 * (`.docs/PRD/07-notifications.md` FR-NOTIF-005: "retried with backoff; dead-letter after N").
 * BullMQ keeps exhausted jobs in a failed set, which is the dead-letter queue — it is only useful
 * if someone watches it, so queue depth by state is exported as `queue_jobs{state="failed"}` and
 * alerted on (S5-10). That claim was in this comment for four sprints before it was true.
 */
import { Queue, Worker, type ConnectionOptions, type Processor } from 'bullmq';
import { Redis } from 'ioredis';

import type { DomainEvent } from '../events/index.js';

import type { Logger } from '../logger/index.js';

export const EVENTS_QUEUE = 'domain-events';

/**
 * How long an enqueue may take before it is abandoned.
 *
 * This is the lesson from the bug that produced `queue.test.ts`: with Redis unreachable,
 * `queue.add` does **not** reject. ioredis queues the command while disconnected and waits for a
 * reconnection that may never come. Unbounded, the caller hangs forever.
 *
 * It no longer runs on the request path — the outbox relay is the only caller (ADR-0019) — but
 * the hazard is the same one and worse in its new home: an unbounded add would hang a relay pass,
 * and with it the relay's shutdown.
 */
const PUBLISH_TIMEOUT_MS = 2000;

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
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
  /**
   * Hands one event to the queue, bounded, and **throws if it did not get there**.
   *
   * The publisher this replaced swallowed the failure, because it ran after a transaction the
   * caller had already committed and failing them would have reported an error for something that
   * succeeded. Its price was the event. The relay has no such constraint: nobody is waiting, and a
   * throw is how the outbox row stays put for the next pass.
   */
  enqueue: (event: DomainEvent) => Promise<void>;
  close: () => Promise<void>;
  /** Readiness probe target — a queue that cannot reach Redis is not ready to serve. */
  ping: () => Promise<void>;
}

export function createEventQueue(connection: Redis): QueueBundle {
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

  const enqueue = async (event: DomainEvent): Promise<void> => {
    // A slow add is treated exactly like a failed one — see PUBLISH_TIMEOUT_MS.
    await withTimeout(queue.add(event.type, event, { jobId: event.eventId }), PUBLISH_TIMEOUT_MS);
  };

  return {
    queue,
    enqueue,
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

const MAINTENANCE_QUEUE = 'connected-maintenance';

/**
 * Scheduled housekeeping — work that runs on a clock rather than in response to an event.
 *
 * A BullMQ repeatable job rather than a cron container: Redis is already here, the schedule lives
 * with the code that implements it, and only one instance runs the job however many replicas are
 * deployed. A cron sidecar would have to be told which of them to talk to.
 */
export function createMaintenanceScheduler(
  connection: Redis,
  logger: Logger,
  tasks: Record<string, () => Promise<void>>,
  schedules: Record<string, string>,
): WorkerBundle & { ready: Promise<void> } {
  const queue = new Queue(MAINTENANCE_QUEUE, {
    connection: connection as unknown as ConnectionOptions,
    defaultJobOptions: { removeOnComplete: 20, removeOnFail: 50 },
  });

  const processor: Processor = async (job) => {
    const task = tasks[job.name];

    if (!task) {
      // An unknown job means a schedule outlived the code that served it. Logged, not thrown:
      // failing it would retry forever.
      logger.warn({ job: job.name }, 'No handler for scheduled job');
      return;
    }

    await task();
  };

  const worker = new Worker(MAINTENANCE_QUEUE, processor, {
    connection: connection as unknown as ConnectionOptions,
    concurrency: 1,
  });

  worker.on('failed', (job, error) => {
    logger.error({ job: job?.name, err: error }, 'Scheduled job failed');
  });

  // `upsertJobScheduler` keyed by name, so a restart replaces the schedule rather than adding a
  // second one — BullMQ 6 replaced the old `repeat` option on `add` for exactly that reason.
  const ready = Promise.all(
    Object.entries(schedules).map(([name, pattern]) =>
      queue.upsertJobScheduler(name, { pattern }, { name }),
    ),
  ).then(() => {
    logger.info({ jobs: Object.keys(schedules) }, 'Scheduled maintenance registered');
  });

  return {
    worker,
    ready,
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}

/**
 * What the worker reports about its own work. Optional, so a test can construct a worker without
 * dragging a registry in — and so the standalone worker process and the in-process one can each
 * supply their own.
 */
export interface WorkerMetrics {
  domainEventsProcessed: { inc: (labels: { type: string; result: string }) => void };
  domainEventLatency: { observe: (labels: { type: string }, value: number) => void };
  queueJobWait: { observe: (labels: { queue: string }, value: number) => void };
}

export function createEventWorker(
  connection: Redis,
  logger: Logger,
  handle: (event: DomainEvent) => Promise<void>,
  metrics?: WorkerMetrics,
): WorkerBundle {
  const processor: Processor = async (job) => {
    const event = job.data as DomainEvent;

    // Enqueued → picked up. BullMQ stamps `timestamp` on add, so this is queue lag measured from
    // the queue itself rather than inferred from when the handler happened to run.
    if (metrics && typeof job.timestamp === 'number') {
      metrics.queueJobWait.observe({ queue: EVENTS_QUEUE }, (Date.now() - job.timestamp) / 1000);
    }

    try {
      await handle(event);
      metrics?.domainEventsProcessed.inc({ type: event.type, result: 'ok' });
    } catch (error) {
      // Counted before rethrowing: BullMQ needs the throw to retry, and a failure that is retried
      // and then succeeds should appear as both, not only as the success.
      metrics?.domainEventsProcessed.inc({ type: event.type, result: 'failed' });
      throw error;
    } finally {
      // Published → handled, whatever the outcome. Measured in the `finally` because a fan-out
      // that takes a minute and then fails is exactly the case this SLI exists to catch.
      if (metrics && event.occurredAt) {
        const elapsed = (Date.now() - new Date(event.occurredAt).getTime()) / 1000;
        // A clock skew between API and worker can make this negative; a negative observation
        // would corrupt the histogram's sum rather than showing up as an outlier.
        if (elapsed >= 0) metrics.domainEventLatency.observe({ type: event.type }, elapsed);
      }
    }
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
