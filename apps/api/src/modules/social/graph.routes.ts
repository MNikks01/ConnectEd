/**
 * Follow and connection routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';
import { requestConnectionSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { GraphService } from './graph.service.js';
import type { ConnectionStatus } from '../../generated/prisma/client.js';
import type { Request, RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

const STATUSES = new Set(['PENDING', 'ACCEPTED']);

function statusFilter(req: Request): ConnectionStatus | undefined {
  const value = req.query.status;
  return typeof value === 'string' && STATUSES.has(value) ? (value as ConnectionStatus) : undefined;
}

export function graphRoutes(service: GraphService): ExpressRouter {
  const router = Router();

  router.post(
    '/accounts/:id/follow',
    handler(async (req, res) => {
      res.status(200).json(await service.follow(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.delete(
    '/accounts/:id/follow',
    handler(async (req, res) => {
      res.status(200).json(await service.unfollow(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.get(
    '/accounts/:id/follow',
    handler(async (req, res) => {
      res.status(200).json(await service.followState(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.post(
    '/connections',
    validateBody(requestConnectionSchema),
    handler(async (req, res) => {
      const { accountId } = req.body as { accountId: string };
      res.status(201).json(await service.requestConnection(requireActor(req), accountId));
    }),
  );

  router.get(
    '/me/connections',
    handler(async (req, res) => {
      res.status(200).json(await service.listConnections(requireActor(req), statusFilter(req)));
    }),
  );

  router.post(
    '/connections/:id/accept',
    handler(async (req, res) => {
      res.status(200).json(await service.acceptConnection(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.delete(
    '/connections/:id',
    handler(async (req, res) => {
      await service.removeConnection(requireActor(req), uuidParam(req, 'id'));
      res.status(204).end();
    }),
  );

  return router;
}
