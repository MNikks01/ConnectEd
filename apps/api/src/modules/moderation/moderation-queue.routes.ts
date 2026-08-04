/**
 * Moderation-queue routes (`.docs/API/03-endpoints.md`).
 *
 * Under `/admin` rather than `/me` or a resource path: this is not the caller's own data and it is
 * not scoped to a school. The prefix is a hint to a reader, never a guard — `assertPlatformAdmin`
 * runs in the service, on every call, against the database.
 */
import { Router } from 'express';
import { moderationDecisionSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { ModerationQueueService } from './moderation-queue.service.js';
import type { ReportStatus } from '../../generated/prisma/client.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

const STATUSES = new Set(['OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED']);

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

export function moderationQueueRoutes(service: ModerationQueueService): ExpressRouter {
  const router = Router();

  router.get(
    '/admin/reports',
    handler(async (req, res) => {
      const raw = typeof req.query.status === 'string' ? req.query.status : undefined;
      // An unrecognised status lists everything rather than erroring: this is a queue filter, and
      // a typo should show the whole queue rather than an error page.
      const status = raw && STATUSES.has(raw) ? (raw as ReportStatus) : undefined;

      res.status(200).json({ data: await service.list(requireActor(req), status) });
    }),
  );

  router.get(
    '/admin/reports/:id',
    handler(async (req, res) => {
      res.status(200).json(await service.get(requireActor(req), uuidParam(req, 'id')));
    }),
  );

  router.post(
    '/admin/reports/:id/decision',
    validateBody(moderationDecisionSchema),
    handler(async (req, res) => {
      const updated = await service.decide(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(200).json(updated);
    }),
  );

  return router;
}
