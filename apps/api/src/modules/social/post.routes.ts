/**
 * Post routes (`.docs/API/03-endpoints.md`).
 *
 * These carry the product's first rate limit outside authentication. Posting is the first thing a
 * stranger can do at volume — `PRD/06-social.md` asks for exactly this under Moderation & safety —
 * and the limit is per account rather than per IP, because a school shares one.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createPostSchema, updatePostSchema } from '@connected/types';

import { parsePageRequest } from '../../shared/http/pagination.js';
import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { PostService } from './post.service.js';
import type { Config } from '../../shared/config/index.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function postRoutes(service: PostService, config: Config): ExpressRouter {
  const router = Router();

  const postingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Per account, not per IP: a school shares an address, and a spammer changes theirs.
    keyGenerator: (req) => requireActor(req).accountId,
    skip: () => !config.RATE_LIMIT_ENABLED,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'You have posted a lot in a short time. Try again later.',
        status: 429,
      },
    },
  });

  router.post(
    '/posts',
    postingLimiter,
    validateBody(createPostSchema),
    handler(async (req, res) => {
      res.status(201).json(await service.create(requireActor(req), req.body as never));
    }),
  );

  router.get(
    '/posts/:id',
    handler(async (req, res) => {
      res.status(200).json(await service.get(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.patch(
    '/posts/:id',
    validateBody(updatePostSchema),
    handler(async (req, res) => {
      res
        .status(200)
        .json(await service.update(requireActor(req), uuidParam(req, 'id'), req.body as never));
    }),
  );

  router.delete(
    '/posts/:id',
    handler(async (req, res) => {
      await service.remove(requireActor(req), uuidParam(req, 'id'));
      res.status(204).end();
    }),
  );

  router.get(
    '/accounts/:id/posts',
    handler(async (req, res) => {
      res
        .status(200)
        .json(
          await service.listTimeline(
            requireActor(req),
            uuidParam(req, 'id'),
            parsePageRequest(req.query),
          ),
        );
    }),
  );

  return router;
}
