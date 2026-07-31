/**
 * Operational endpoints. These sit outside `/api/v1` — they are infrastructure contracts
 * (probes, scrapers), not part of the versioned public API.
 *
 * Dependencies arrive as arguments rather than module imports, so these routes can be exercised
 * against a stub registry without touching global state or the environment.
 */
import { Router } from 'express';

import { ErrorCode } from '../shared/errors/index.js';

import type { ReadinessRegistry } from '../shared/health/readiness.js';
import type { Metrics } from '../shared/observability/metrics.js';
import type { Request, Response } from 'express';

export interface HealthRoutesOptions {
  readiness: ReadinessRegistry;
  metrics: Metrics;
  /** When false, `/metrics` 404s. Network-level restriction is handled by the infra. */
  metricsEnabled: boolean;
}

export function healthRoutes({ readiness, metrics, metricsEnabled }: HealthRoutesOptions): Router {
  const router = Router();

  /**
   * Liveness. Answers "is this process alive" only — it must never check dependencies, or a
   * database blip would make the orchestrator kill otherwise-healthy instances.
   */
  router.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  /** Readiness. Fails closed with 503 so the load balancer stops routing traffic here. */
  router.get('/readyz', async (req: Request, res: Response) => {
    const { ready, results } = await readiness.run();

    if (ready) {
      res.status(200).json({ status: 'ready', checks: results });
      return;
    }

    res.status(503).json({
      error: {
        code: ErrorCode.DEPENDENCY_UNAVAILABLE,
        message: 'One or more dependencies are unavailable.',
        status: 503,
        correlationId: req.correlationId,
        details: results
          .filter((result) => result.status === 'down')
          .map((result) => ({ field: result.name, issue: result.error ?? 'unavailable' })),
      },
    });
  });

  /** Prometheus scrape target. */
  router.get('/metrics', async (_req: Request, res: Response) => {
    if (!metricsEnabled) {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', metrics.registry.contentType);
    res.status(200).send(await metrics.registry.metrics());
  });

  return router;
}
