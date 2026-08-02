/**
 * Messaging routes (`.docs/API/03-endpoints.md`).
 *
 * Sending carries a rate limit for the same reason posting does: this is the second thing in the
 * product a stranger can do at volume, and the one that arrives in someone's inbox.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { sendMessageSchema, startThreadSchema } from '@connected/types';

import { parsePageRequest } from '../../shared/http/pagination.js';
import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { MessageService } from './message.service.js';
import type { Config } from '../../shared/config/index.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function messageRoutes(service: MessageService, config: Config): ExpressRouter {
  const router = Router();

  const messagingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    // Higher than posting: a conversation is many short messages, and one is not spam.
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => requireActor(req).accountId,
    skip: () => !config.RATE_LIMIT_ENABLED,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'You have sent a lot of messages in a short time. Try again later.',
        status: 429,
      },
    },
  });

  router.post(
    '/threads',
    validateBody(startThreadSchema),
    handler(async (req, res) => {
      const { accountId } = req.body as { accountId: string };
      // 200, not 201: asking twice returns the same thread, and the second is not a creation.
      res.status(200).json(await service.startThread(requireActor(req), accountId));
    }),
  );

  router.get(
    '/threads',
    handler(async (req, res) => {
      res.status(200).json(await service.inbox(requireActor(req)));
    }),
  );

  router.get(
    '/threads/:id/messages',
    handler(async (req, res) => {
      res
        .status(200)
        .json(
          await service.readThread(
            requireActor(req),
            uuidParam(req, 'id'),
            parsePageRequest(req.query),
          ),
        );
    }),
  );

  router.post(
    '/threads/:id/messages',
    messagingLimiter,
    validateBody(sendMessageSchema),
    handler(async (req, res) => {
      const { body } = req.body as { body: string };
      res.status(201).json(await service.send(requireActor(req), uuidParam(req, 'id'), body));
    }),
  );

  return router;
}
