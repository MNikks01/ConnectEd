/**
 * Operational endpoints. These sit outside `/api/v1` — they are infrastructure contracts
 * (probes, scrapers), not part of the versioned public API.
 */
import { Router } from 'express';

import { runReadinessChecks } from '../shared/health/readiness.js';
import { config } from '../shared/config/index.js';
import { ErrorCode } from '../shared/errors/index.js';
import { registry } from '../shared/observability/metrics.js';

import type { Request, Response } from 'express';

export function healthRoutes(): Router {
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
    const { ready, results } = await runReadinessChecks();

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

  /**
   * Prometheus scrape target. Exposure is also restricted at the network layer
   * (`.docs/Monitoring/00-observability.md`); this flag is the in-process half of that.
   */
  router.get('/metrics', async (_req: Request, res: Response) => {
    if (!config.METRICS_ENABLED) {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', registry.contentType);
    res.status(200).send(await registry.metrics());
  });

  return router;
}
