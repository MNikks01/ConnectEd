/**
 * Notification routes. Everything is scoped to the caller — there is no path that reads someone
 * else's notifications, by design.
 */
import { Router } from 'express';

import { parsePageRequest } from '../../shared/http/pagination.js';
import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';
import { updateNotificationPrefsSchema } from '@connected/types';

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

  /**
   * `/me/*` because the answer is about the caller and nobody else (`API/01-conventions.md`).
   * Listed before `/notifications` only for readability; Express matches on the path, not order.
   */
  router.get(
    '/me/notification-prefs',
    handler(async (req, res) => {
      res.status(200).json({ data: await service.preferences(requireActor(req)) });
    }),
  );

  router.patch(
    '/me/notification-prefs',
    validateBody(updateNotificationPrefsSchema),
    handler(async (req, res) => {
      const updated = await service.updatePreferences(requireActor(req), req.body as never);
      res.status(200).json({ data: updated });
    }),
  );

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
