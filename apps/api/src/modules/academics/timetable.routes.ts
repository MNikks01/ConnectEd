/**
 * Timetable routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';
import { uploadTimetableSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { TimetableService } from './timetable.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function timetableRoutes(service: TimetableService): ExpressRouter {
  const router = Router();

  router.post(
    '/classes/:id/timetable',
    validateBody(uploadTimetableSchema),
    handler(async (req, res) => {
      const created = await service.upload(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(201).json(created);
    }),
  );

  router.get(
    '/classes/:id/timetable',
    handler(async (req, res) => {
      res.status(200).json(await service.current(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.get(
    '/classes/:id/timetable/versions',
    handler(async (req, res) => {
      res.status(200).json(await service.history(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  return router;
}
