/**
 * Subject-rights routes (`.docs/PRD/14-export-and-erasure.md`).
 *
 * **Everything hangs off `/me`, and that is the enforcement, not the naming convention.** There is
 * no `/accounts/:id/export`, because an endpoint shaped like that would need a policy deciding who
 * may export whose data, and there is no correct answer to that question in this product — not the
 * school, not a principal, not staff. A path with no id cannot be pointed at the wrong person.
 *
 * The single exception is the download, whose id names an export rather than an account, and which
 * the service re-checks against the caller before signing anything.
 */
import { Router } from 'express';
import { requestErasureSchema } from '@connected/types';

import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { PrivacyService } from './privacy.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

const handler =
  (fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>) =>
  (...args: Parameters<RequestHandler>) => {
    void fn(args[0], args[1]).catch(args[2]);
  };

export function privacyRoutes(service: PrivacyService): ExpressRouter {
  const router = Router();

  router.get(
    '/me/privacy',
    handler(async (req, res) => {
      res.status(200).json(await service.status(requireActor(req)));
    }),
  );

  router.post(
    '/me/exports',
    handler(async (req, res) => {
      res.status(202).json(await service.requestExport(requireActor(req)));
    }),
  );

  router.get(
    '/me/exports',
    handler(async (req, res) => {
      res.status(200).json({ data: await service.listExports(requireActor(req)) });
    }),
  );

  /**
   * Returns the URL rather than redirecting to it. A `302` to a signed S3 URL would put the
   * credential in the browser's history and in any referrer the download triggers; handing it back
   * as JSON lets the client fetch it once and forget it.
   */
  router.post(
    '/me/exports/:id/download',
    handler(async (req, res) => {
      const result = await service.downloadExport(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json(result);
    }),
  );

  router.post(
    '/me/erasure',
    validateBody(requestErasureSchema),
    handler(async (req, res) => {
      const result = await service.requestErasure(requireActor(req), req.body as never);
      res.status(202).json(result);
    }),
  );

  router.delete(
    '/me/erasure',
    handler(async (req, res) => {
      await service.cancelErasure(requireActor(req));
      res.status(204).send();
    }),
  );

  return router;
}
