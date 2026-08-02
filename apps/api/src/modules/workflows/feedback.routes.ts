/**
 * Complaint and suggestion routes (`.docs/API/03-endpoints.md`).
 */
import { Router } from 'express';
import { reviewFeedbackSchema, submitFeedbackSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { FeedbackService } from './feedback.service.js';
import type { FeedbackStatus } from '../../generated/prisma/client.js';
import type { Request, RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

const STATUSES = new Set(['OPEN', 'UNDER_REVIEW', 'RESOLVED']);

/** An unrecognised `?status=` is ignored: it filters, it does not authorize. */
function statusFilter(req: Request): FeedbackStatus | undefined {
  const value = req.query.status;
  return typeof value === 'string' && STATUSES.has(value) ? (value as FeedbackStatus) : undefined;
}

export function feedbackRoutes(service: FeedbackService): ExpressRouter {
  const router = Router();

  router.post(
    '/schools/:id/feedback',
    validateBody(submitFeedbackSchema),
    handler(async (req, res) => {
      const created = await service.submit(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(201).json(created);
    }),
  );

  router.get(
    '/schools/:id/feedback',
    handler(async (req, res) => {
      res
        .status(200)
        .json(
          await service.listForSchool(requireActor(req), uuidParam(req, 'id'), statusFilter(req)),
        );
    }),
  );

  router.get(
    '/me/feedback',
    handler(async (req, res) => {
      res.status(200).json(await service.listMine(requireActor(req)));
    }),
  );

  router.post(
    '/feedback/:id/review',
    validateBody(reviewFeedbackSchema),
    handler(async (req, res) => {
      res
        .status(200)
        .json(await service.review(requireActor(req), uuidParam(req, 'id'), req.body as never));
    }),
  );

  return router;
}
