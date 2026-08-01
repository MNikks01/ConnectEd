/**
 * Syllabus coverage routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';
import { upsertSyllabusTopicSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { SyllabusService } from './syllabus.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function syllabusRoutes(service: SyllabusService): ExpressRouter {
  const router = Router();

  router.post(
    '/subjects/:id/syllabus',
    validateBody(upsertSyllabusTopicSchema),
    handler(async (req, res) => {
      const recorded = await service.record(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      // 200, not 201: recording the same topic twice updates it rather than creating a second.
      res.status(200).json(recorded);
    }),
  );

  router.get(
    '/classes/:id/syllabus',
    handler(async (req, res) => {
      res.status(200).json(await service.classCoverage(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.get(
    '/subjects/:id/syllabus',
    handler(async (req, res) => {
      res.status(200).json(await service.coverage(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.delete(
    '/syllabus/:id',
    handler(async (req, res) => {
      await service.removeTopic(requireActor(req), uuidParam(req, 'id'));
      res.status(204).end();
    }),
  );

  return router;
}
