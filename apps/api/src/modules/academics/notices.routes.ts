/**
 * Notice and event routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';
import {
  createEventSchema,
  createNoticeSchema,
  updateEventSchema,
  updateNoticeSchema,
} from '@connected/types';

import { parsePageRequest } from '../../shared/http/pagination.js';
import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { NoticesService } from './notices.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function noticesRoutes(service: NoticesService): ExpressRouter {
  const router = Router();

  router.post(
    '/schools/:id/notices',
    validateBody(createNoticeSchema),
    handler(async (req, res) => {
      const created = await service.publishNotice(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(201).json(created);
    }),
  );

  router.get(
    '/schools/:id/notices',
    handler(async (req, res) => {
      res
        .status(200)
        .json(
          await service.listNotices(
            requireActor(req),
            uuidParam(req, 'id'),
            parsePageRequest(req.query),
          ),
        );
    }),
  );

  router.get(
    '/notices/:id',
    handler(async (req, res) => {
      res.status(200).json(await service.readNotice(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.patch(
    '/notices/:id',
    validateBody(updateNoticeSchema),
    handler(async (req, res) => {
      res
        .status(200)
        .json(
          await service.updateNotice(requireActor(req), uuidParam(req, 'id'), req.body as never),
        );
    }),
  );

  router.delete(
    '/notices/:id',
    handler(async (req, res) => {
      await service.removeNotice(requireActor(req), uuidParam(req, 'id'));
      res.status(204).end();
    }),
  );

  router.post(
    '/schools/:id/events',
    validateBody(createEventSchema),
    handler(async (req, res) => {
      const created = await service.createEvent(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(201).json(created);
    }),
  );

  router.get(
    '/schools/:id/events',
    handler(async (req, res) => {
      // Upcoming by default: the school year's past events are history, not the list a parent
      // opens to see what is on next week.
      res.status(200).json(
        await service.listEvents(requireActor(req), uuidParam(req, 'id'), {
          includePast: req.query.includePast === 'true',
        }),
      );
    }),
  );

  router.patch(
    '/events/:id',
    validateBody(updateEventSchema),
    handler(async (req, res) => {
      res
        .status(200)
        .json(
          await service.updateEvent(requireActor(req), uuidParam(req, 'id'), req.body as never),
        );
    }),
  );

  router.delete(
    '/events/:id',
    handler(async (req, res) => {
      await service.removeEvent(requireActor(req), uuidParam(req, 'id'));
      res.status(204).end();
    }),
  );

  return router;
}
