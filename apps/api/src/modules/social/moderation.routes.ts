/**
 * Block and report routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';
import { createReportSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { ModerationService } from './moderation.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function moderationRoutes(service: ModerationService): ExpressRouter {
  const router = Router();

  router.post(
    '/accounts/:id/block',
    handler(async (req, res) => {
      res.status(200).json(await service.block(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.delete(
    '/accounts/:id/block',
    handler(async (req, res) => {
      res.status(200).json(await service.unblock(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.get(
    '/me/blocks',
    handler(async (req, res) => {
      res.status(200).json(await service.listBlocked(requireActor(req)));
    }),
  );

  router.post(
    '/reports',
    validateBody(createReportSchema),
    handler(async (req, res) => {
      res.status(201).json(await service.report(requireActor(req), req.body as never));
    }),
  );

  router.get(
    '/me/reports',
    handler(async (req, res) => {
      res.status(200).json(await service.listMyReports(requireActor(req)));
    }),
  );

  return router;
}
