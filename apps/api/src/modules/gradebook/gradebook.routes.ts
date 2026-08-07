/**
 * Gradebook routes.
 *
 * Two shapes of read, deliberately on different paths: `/assessments/:id/marks` is the *marking*
 * view and answers with everybody's mark, while `/me/...` and `/children/:childId/...` answer with
 * one pupil's. Keeping them apart means a permission mistake on one cannot quietly widen the other.
 */
import { Router } from 'express';
import { correctMarkSchema, createAssessmentSchema, enterMarksSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { GradebookService } from './gradebook.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

const handler =
  (fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>) =>
  (...args: Parameters<RequestHandler>) => {
    void fn(args[0], args[1]).catch(args[2]);
  };

export function gradebookRoutes(service: GradebookService): ExpressRouter {
  const router = Router();

  router.post(
    '/classes/:id/assessments',
    validateBody(createAssessmentSchema),
    handler(async (req, res) => {
      const created = await service.createAssessment(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(201).json(created);
    }),
  );

  router.put(
    '/assessments/:id/marks',
    validateBody(enterMarksSchema),
    handler(async (req, res) => {
      await service.enterMarks(requireActor(req), uuidParam(req, 'id'), req.body as never);
      res.status(204).send();
    }),
  );

  router.post(
    '/assessments/:id/publish',
    handler(async (req, res) => {
      res.status(200).json(await service.publish(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.patch(
    '/assessments/:id/marks/:studentAccountId',
    validateBody(correctMarkSchema),
    handler(async (req, res) => {
      const corrected = await service.correctMark(
        requireActor(req),
        uuidParam(req, 'id'),
        uuidParam(req, 'studentAccountId'),
        req.body as never,
      );
      res.status(200).json(corrected);
    }),
  );

  router.get(
    '/assessments/:id/marks',
    handler(async (req, res) => {
      res.status(200).json(await service.listMarks(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.delete(
    '/assessments/:id',
    handler(async (req, res) => {
      await service.removeAssessment(requireActor(req), uuidParam(req, 'id'));
      res.status(204).send();
    }),
  );

  /** A pupil's own. */
  router.get(
    '/me/classes/:id/marks',
    handler(async (req, res) => {
      const data = await service.listMine(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json({ data });
    }),
  );

  /** A parent's, for one child, resolved through the link the school confirmed. */
  router.get(
    '/children/:id/marks',
    handler(async (req, res) => {
      const data = await service.listForChild(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json({ data });
    }),
  );

  return router;
}
