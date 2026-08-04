/**
 * Analytics routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';

import type { AnalyticsService } from './analytics.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

/** Bounded so a caller cannot ask for a window that scans every row a school has ever written. */
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

function daysFrom(raw: unknown): number {
  const parsed = Number(raw);
  // Anything unparseable falls back rather than 422ing: this is a dashboard control, and a
  // mistyped query string should show the default month, not an error page.
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_DAYS;
  return Math.min(Math.floor(parsed), MAX_DAYS);
}

export function analyticsRoutes(service: AnalyticsService): ExpressRouter {
  const router = Router();

  router.get(
    '/schools/:id/analytics',
    handler(async (req, res) => {
      const analytics = await service.forSchool(
        requireActor(req),
        uuidParam(req, 'id'),
        daysFrom(req.query.days),
      );
      res.status(200).json(analytics);
    }),
  );

  return router;
}
