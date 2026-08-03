/**
 * Billing routes (`.docs/API/03-endpoints.md`).
 *
 * One route so far, and it is a read. Nothing here charges anyone — checkout is S5-4 and waits on
 * the provider decision (ADR-0015).
 */
import { Router } from 'express';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';

import type { BillingService } from './billing.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

/** Wraps an async handler so a rejection reaches the error middleware rather than hanging. */
function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function billingRoutes(service: BillingService): ExpressRouter {
  const router = Router();

  router.get(
    '/schools/:id/subscription',
    handler(async (req, res) => {
      const subscription = await service.subscriptionFor(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json(subscription);
    }),
  );

  return router;
}
