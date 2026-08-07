/**
 * Attendance routes.
 *
 * As with the gradebook, the register and a pupil's own record are on different paths: one carries
 * the whole class, the other carries one child, and a permission mistake on one must not widen the
 * other.
 */
import { Router } from 'express';
import { takeRegisterSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { AttendanceService } from './attendance.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

const handler =
  (fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>) =>
  (...args: Parameters<RequestHandler>) => {
    void fn(args[0], args[1]).catch(args[2]);
  };

export function attendanceRoutes(service: AttendanceService): ExpressRouter {
  const router = Router();

  router.get(
    '/classes/:id/register',
    handler(async (req, res) => {
      // The date is a query parameter rather than a path segment: a register is a view of a class
      // on a day, not a resource of its own, and there is nothing to link to when it is untaken.
      const onDate =
        typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);

      res
        .status(200)
        .json(await service.getRegister(requireActor(req), uuidParam(req, 'id'), onDate));
    }),
  );

  router.put(
    '/classes/:id/register',
    validateBody(takeRegisterSchema),
    handler(async (req, res) => {
      await service.takeRegister(requireActor(req), uuidParam(req, 'id'), req.body as never);
      res.status(204).send();
    }),
  );

  router.get(
    '/me/classes/:id/attendance',
    handler(async (req, res) => {
      const data = await service.listMine(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json({ data });
    }),
  );

  router.get(
    '/children/:id/attendance',
    handler(async (req, res) => {
      const data = await service.listForChild(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json({ data });
    }),
  );

  return router;
}
