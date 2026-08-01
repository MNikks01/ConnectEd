/**
 * Notification routes. Everything is scoped to the caller — there is no path that reads someone
 * else's notifications, by design.
 */
import { Router } from 'express';

import { parsePageRequest } from '../../shared/http/pagination.js';
import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';

import type { NotificationsService } from './notifications.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function notificationsRoutes(service: NotificationsService): ExpressRouter {
  const router = Router();

  router.get(
    '/notifications',
    handler(async (req, res) => {
      res.status(200).json(
        await service.list(requireActor(req), {
          unreadOnly: req.query.unreadOnly === 'true',
          page: parsePageRequest(req.query),
        }),
      );
    }),
  );

  router.post(
    '/notifications/read-all',
    handler(async (req, res) => {
      res.status(200).json(await service.markAllRead(requireActor(req)));
    }),
  );

  router.post(
    '/notifications/:id/read',
    handler(async (req, res) => {
      await service.markRead(requireActor(req), uuidParam(req, 'id'));
      res.status(204).end();
    }),
  );

  return router;
}
