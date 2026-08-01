/**
 * Academic content routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';
import { publishAcademicItemSchema, updateAcademicItemSchema } from '@connected/types';

import { parsePageRequest } from '../../shared/http/pagination.js';
import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { AcademicsService } from './academics.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function academicsRoutes(service: AcademicsService): ExpressRouter {
  const router = Router();

  router.post(
    '/classes/:id/academics',
    validateBody(publishAcademicItemSchema),
    handler(async (req, res) => {
      const created = await service.publish(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(201).json(created);
    }),
  );

  router.get(
    '/classes/:id/academics',
    handler(async (req, res) => {
      res
        .status(200)
        .json(
          await service.listForClass(
            requireActor(req),
            uuidParam(req, 'id'),
            parsePageRequest(req.query),
          ),
        );
    }),
  );

  // Reading marks the item read for the caller, so this is a GET with a deliberate side effect —
  // the alternative is a second round trip every client would have to remember to make.
  router.get(
    '/academics/:id',
    handler(async (req, res) => {
      res.status(200).json(await service.read(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.patch(
    '/academics/:id',
    validateBody(updateAcademicItemSchema),
    handler(async (req, res) => {
      const updated = await service.update(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(200).json(updated);
    }),
  );

  router.delete(
    '/academics/:id',
    handler(async (req, res) => {
      await service.remove(requireActor(req), uuidParam(req, 'id'));
      res.status(204).end();
    }),
  );

  return router;
}
