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
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface Metrics {
  registry: Registry;
  httpRequestDuration: Histogram<'method' | 'route' | 'status'>;
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

  return { registry, httpRequestDuration, middleware };
}
