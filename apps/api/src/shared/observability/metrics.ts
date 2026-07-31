/**
 * Prometheus metrics (`.docs/Monitoring/00-observability.md`).
 *
 * RED signals come from `http_request_duration_seconds`; module-specific business counters
 * (homework_published_total, member_verified_total, …) register against the same registry as
 * their modules land.
 */
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

import type { NextFunction, Request, Response } from 'express';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds.',
  labelNames: ['method', 'route', 'status'] as const,
  // Tuned for a web API: sub-100ms is the target, 10s is effectively a timeout.
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/**
 * Labels use the matched Express route pattern (`/classes/:id`), never the raw URL — raw paths
 * carry UUIDs and would blow up label cardinality.
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

export function httpMetrics() {
  return (req: Request, res: Response, next: NextFunction): void => {
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
}
