/**
 * Term and report-card routes.
 *
 * Terms hang off the school because a school defines its own; cards hang off a class because that
 * is the unit they are issued in (FR-GRADE-040). A pupil's own cards and a parent's child's cards
 * are separate paths again, for the reason the gradebook and the register keep them separate: a
 * permission mistake on the class path must not widen the family one.
 */
import { Router } from 'express';
import { createTermSchema, issueReportCardsSchema } from '@connected/types';

import { uuidParam, uuidQuery } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { ReportCardsService } from './reportcards.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

const handler =
  (fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>) =>
  (...args: Parameters<RequestHandler>) => {
    void fn(args[0], args[1]).catch(args[2]);
  };

export function reportCardsRoutes(service: ReportCardsService): ExpressRouter {
  const router = Router();

  router.post(
    '/schools/:id/terms',
    validateBody(createTermSchema),
    handler(async (req, res) => {
      const term = await service.createTerm(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(201).json(term);
    }),
  );

  router.get(
    '/schools/:id/terms',
    handler(async (req, res) => {
      const data = await service.listTerms(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json({ data });
    }),
  );

  router.post(
    '/classes/:id/report-cards',
    validateBody(issueReportCardsSchema),
    handler(async (req, res) => {
      await service.issue(requireActor(req), uuidParam(req, 'id'), req.body as never);
      res.status(204).send();
    }),
  );

  router.get(
    '/classes/:id/report-cards',
    handler(async (req, res) => {
      // The term is required rather than defaulted: "this class's cards" with no term is a
      // question about which term, and guessing the current one would quietly show a family's
      // document to somebody who asked for a different one.
      const data = await service.listForClass(
        requireActor(req),
        uuidParam(req, 'id'),
        uuidQuery(req, 'termId'),
      );
      res.status(200).json({ data });
    }),
  );

  router.get(
    '/me/report-cards',
    handler(async (req, res) => {
      res.status(200).json({ data: await service.listMine(requireActor(req)) });
    }),
  );

  router.get(
    '/children/:id/report-cards',
    handler(async (req, res) => {
      const data = await service.listForChild(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json({ data });
    }),
  );

  return router;
}
