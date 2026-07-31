/**
 * Institution routes (`.docs/API/03-endpoints.md`).
 *
 * Every route is behind `authenticate`; the finer-grained decision (is this *your* school?) is the
 * service's, because only it can see the resource. A route guard here would be a second, weaker
 * copy of that rule.
 */
import { Router } from 'express';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';
import {
  createClassSchema,
  createSubjectSchema,
  updateClassSchema,
  updateSchoolProfileSchema,
} from '@connected/types';

import type { InstitutionService } from './institution.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

/** Wraps an async handler so a rejection reaches the error middleware rather than hanging. */
function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function institutionRoutes(service: InstitutionService): ExpressRouter {
  const router = Router();

  router.get(
    '/schools/:id',
    handler(async (req, res) => {
      const profile = await service.getSchoolProfile(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json(profile);
    }),
  );

  router.patch(
    '/schools/:id',
    validateBody(updateSchoolProfileSchema),
    handler(async (req, res) => {
      const profile = await service.updateSchoolProfile(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(200).json(profile);
    }),
  );

  router.post(
    '/schools/:id/classes',
    validateBody(createClassSchema),
    handler(async (req, res) => {
      const created = await service.createClass(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(201).json(created);
    }),
  );

  router.get(
    '/schools/:id/classes',
    handler(async (req, res) => {
      const classes = await service.listClasses(requireActor(req), uuidParam(req, 'id'), {
        includeInactive: req.query.includeInactive === 'true',
      });
      res.status(200).json({ data: classes });
    }),
  );

  router.patch(
    '/classes/:id',
    validateBody(updateClassSchema),
    handler(async (req, res) => {
      const updated = await service.updateClass(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(200).json(updated);
    }),
  );

  router.post(
    '/classes/:id/subjects',
    validateBody(createSubjectSchema),
    handler(async (req, res) => {
      const created = await service.createSubject(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(201).json(created);
    }),
  );

  router.get(
    '/classes/:id/subjects',
    handler(async (req, res) => {
      const subjects = await service.listSubjects(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json({ data: subjects });
    }),
  );

  return router;
}
