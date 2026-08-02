/**
 * Leave routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';
import {
  applyForChildLeaveSchema,
  applyForOwnLeaveSchema,
  leaveDecisionSchema,
} from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { LeaveService } from './leave.service.js';
import type { LeaveStatus } from '../../generated/prisma/client.js';
import type { Request, RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

const STATUSES = new Set(['RECEIVED', 'ACCEPTED', 'REJECTED']);

/** An unrecognised `?status=` is ignored rather than rejected: it filters, it does not authorize. */
function statusFilter(req: Request): LeaveStatus | undefined {
  const value = req.query.status;
  return typeof value === 'string' && STATUSES.has(value) ? (value as LeaveStatus) : undefined;
}

export function leaveRoutes(service: LeaveService): ExpressRouter {
  const router = Router();

  router.post(
    '/children/:childId/leave',
    validateBody(applyForChildLeaveSchema),
    handler(async (req, res) => {
      const created = await service.applyForChild(
        requireActor(req),
        uuidParam(req, 'childId'),
        req.body as never,
      );
      res.status(201).json(created);
    }),
  );

  router.post(
    '/me/leave',
    validateBody(applyForOwnLeaveSchema),
    handler(async (req, res) => {
      res.status(201).json(await service.applyForSelf(requireActor(req), req.body as never));
    }),
  );

  router.get(
    '/me/leave',
    handler(async (req, res) => {
      res.status(200).json(await service.listMine(requireActor(req)));
    }),
  );

  router.get(
    '/classes/:id/leave',
    handler(async (req, res) => {
      res
        .status(200)
        .json(
          await service.listForClass(requireActor(req), uuidParam(req, 'id'), statusFilter(req)),
        );
    }),
  );

  router.get(
    '/schools/:id/leave/teacher',
    handler(async (req, res) => {
      res
        .status(200)
        .json(
          await service.listTeacherLeave(
            requireActor(req),
            uuidParam(req, 'id'),
            statusFilter(req),
          ),
        );
    }),
  );

  router.post(
    '/leave/:id/decision',
    validateBody(leaveDecisionSchema),
    handler(async (req, res) => {
      res
        .status(200)
        .json(await service.decide(requireActor(req), uuidParam(req, 'id'), req.body as never));
    }),
  );

  return router;
}
