/**
 * Prometheus metrics (`.docs/Monitoring/00-observability.md`).
 *
 * A factory rather than module-level constants: registering default metrics on import is a side
 * effect that fires merely because something imported this file, and a shared registry makes two
 * apps in one process (tests do exactly that) accumulate into each other.
 *
 * RED signals come from `http_request_duration_seconds`; module-specific business counters
 * (homework_published_total, member_verified_total, …) register against the same instance.
 */
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface Metrics {
  registry: Registry;
  httpRequestDuration: Histogram<'method' | 'route' | 'status'>;
  /**
   * Fan-out outcome per domain event. `result` is the worker's verdict on the whole handler, not
   * per recipient — named for what it measures rather than for the SLO it feeds, because a metric
   * that overclaims is worse than one that is missing.
   */
  domainEventsProcessed: Counter<'type' | 'result'>;
  /**
   * Publish → handled, across the queue. This is the SLI behind "homework publish → notification
   * median < 10s": the event carries `occurredAt` from the moment the domain change committed.
   */
  domainEventLatency: Histogram<'type'>;
  /** Enqueued → started. Queue lag, the SLI with the 30s p95 objective. */
  queueJobWait: Histogram<'queue'>;
  /** Records duration for every request; mount early so it sees the full handler chain. */
  middleware: RequestHandler;
}

/**
 * Labels use the matched Express route pattern (`/classes/:id`), never the raw URL — raw paths
 * carry UUIDs and one label per UUID is how a metrics bill runs away.
 */
function routeLabel(req: Request): string {
  // `req.route` is untyped in @types/express and absent until a route matches.
  const route: unknown = req.route;
  const path =
    typeof route === 'object' && route !== null && 'path' in route ? route.path : undefined;

  if (typeof path === 'string') {
    return `${req.baseUrl}${path}`;
  }
  // Unmatched requests share one label so scanners cannot mint new time series.
  return req.baseUrl || 'unmatched';
}

export function createMetrics(): Metrics {
  const registry = new Registry();

  collectDefaultMetrics({ register: registry });

  const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds.',
    labelNames: ['method', 'route', 'status'] as const,
    // Tuned for a web API: sub-100ms is the target, 10s is effectively a timeout.
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    const stopTimer = httpRequestDuration.startTimer();

    res.on('finish', () => {
      stopTimer({
        method: req.method,
        route: routeLabel(req),
        status: String(res.statusCode),
      });
    });

    next();
  };

  const domainEventsProcessed = new Counter({
    name: 'domain_events_processed_total',
    help: 'Domain events handled by the worker, by type and outcome.',
    labelNames: ['type', 'result'] as const,
    registers: [registry],
  });

  const domainEventLatency = new Histogram({
    name: 'domain_event_latency_seconds',
    help: 'Seconds from a domain event being published to its fan-out completing.',
    labelNames: ['type'] as const,
    // The SLO is a 10s median, so the buckets straddle it rather than clustering below it.
    buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 300],
    registers: [registry],
  });

  const queueJobWait = new Histogram({
    name: 'queue_job_wait_seconds',
    help: 'Seconds a job waited between being enqueued and being picked up.',
    labelNames: ['queue'] as const,
    // The SLO is a 30s p95; 300 catches a worker that has stopped consuming entirely.
    buckets: [0.05, 0.1, 0.5, 1, 5, 15, 30, 60, 300],
    registers: [registry],
  });

  return {
    registry,
    httpRequestDuration,
    domainEventsProcessed,
    domainEventLatency,
    queueJobWait,
    middleware,
  };
}

/**
 * Postgres pool occupancy, read at scrape time.
 *
 * A `collect` callback rather than a value pushed on every checkout: the pool already knows the
 * answer, and sampling it when someone asks costs nothing between scrapes. `waiting` is the number
 * that matters — total and idle describe the pool, but a non-zero waiting count is requests
 * queueing for a connection, which is what exhaustion looks like from the inside.
 */
export function registerDbPoolMetrics(
  registry: Registry,
  pool: { totalCount: number; idleCount: number; waitingCount: number },
): void {
  new Gauge({
    name: 'db_pool_connections',
    help: 'Postgres pool connections by state.',
    labelNames: ['state'] as const,
    registers: [registry],
    collect() {
      this.set({ state: 'total' }, pool.totalCount);
      this.set({ state: 'idle' }, pool.idleCount);
      this.set({ state: 'in_use' }, pool.totalCount - pool.idleCount);
      this.set({ state: 'waiting' }, pool.waitingCount);
    },
  });
}

/**
 * Queue depth, read at scrape time.
 *
 * `failed` is the dead-letter set: BullMQ keeps jobs that exhausted their retries there rather
 * than discarding them, which is only useful if someone watches it. Now something does.
 */
export function registerQueueDepthMetrics(
  registry: Registry,
  queues: Record<string, { getJobCounts: () => Promise<Record<string, number>> }>,
): void {
  new Gauge({
    name: 'queue_jobs',
    help: 'Jobs in each queue, by state.',
    labelNames: ['queue', 'state'] as const,
    registers: [registry],
    async collect() {
      for (const [name, queue] of Object.entries(queues)) {
        try {
          const counts = await queue.getJobCounts();
          for (const [state, count] of Object.entries(counts)) {
            this.set({ queue: name, state }, count);
          }
        } catch {
          // Redis being unreachable is already alerted on by its own probe. A scrape that throws
          // here would take every other metric on the endpoint with it, including the ones that
          // would tell an on-call engineer what is actually wrong.
        }
      }
    },
  });
}
