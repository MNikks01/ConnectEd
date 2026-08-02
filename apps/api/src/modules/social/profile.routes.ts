/**
 * Profile routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';
import { updateProfileSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { ProfileService } from './profile.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function profileRoutes(service: ProfileService): ExpressRouter {
  const router = Router();

  router.get(
    '/me/profile',
    handler(async (req, res) => {
      res.status(200).json(await service.getMine(requireActor(req)));
    }),
  );

  router.patch(
    '/me/profile',
    validateBody(updateProfileSchema),
    handler(async (req, res) => {
      res.status(200).json(await service.updateMine(requireActor(req), req.body as never));
    }),
  );

  router.get(
    '/accounts/:id/profile',
    handler(async (req, res) => {
      res.status(200).json(await service.get(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  return router;
}
