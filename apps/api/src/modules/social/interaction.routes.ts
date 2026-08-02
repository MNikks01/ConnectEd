/**
 * Like and comment routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';
import { createCommentSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { InteractionService } from './interaction.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function interactionRoutes(service: InteractionService): ExpressRouter {
  const router = Router();

  router.post(
    '/posts/:id/like',
    handler(async (req, res) => {
      // 200, not 201: it is a toggle, and the same request twice leaves you where you started.
      res.status(200).json(await service.toggleLike(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.post(
    '/posts/:id/comments',
    validateBody(createCommentSchema),
    handler(async (req, res) => {
      res
        .status(201)
        .json(await service.comment(requireActor(req), uuidParam(req, 'id'), req.body as never));
    }),
  );

  router.get(
    '/posts/:id/comments',
    handler(async (req, res) => {
      res.status(200).json(await service.listComments(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.delete(
    '/comments/:id',
    handler(async (req, res) => {
      await service.removeComment(requireActor(req), uuidParam(req, 'id'));
      res.status(204).end();
    }),
  );

  return router;
}
