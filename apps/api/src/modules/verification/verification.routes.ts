/**
 * Verification routes (`.docs/API/03-endpoints.md`).
 *
 * All authorization is the service's — only it can see whose school a request belongs to.
 */
import { Router } from 'express';
import { submitVerificationSchema, verificationDecisionSchema } from '@connected/types';

import { parsePageRequest } from '../../shared/http/pagination.js';
import { uuidParam } from '../../shared/http/params.js';
import { requireActor } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';

import type { VerificationService } from './verification.service.js';
import type { VerificationStatus } from '../../generated/prisma/client.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

function handler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

const STATUSES = new Set(['PENDING', 'VERIFIED', 'REJECTED', 'REVOKED']);

/** An unrecognised `?status=` is ignored rather than rejected — it is a filter, not a command. */
function statusFilter(value: unknown): VerificationStatus | undefined {
  return typeof value === 'string' && STATUSES.has(value)
    ? (value as VerificationStatus)
    : undefined;
}

export function verificationRoutes(service: VerificationService): ExpressRouter {
  const router = Router();

  router.post(
    '/verifications',
    validateBody(submitVerificationSchema),
    handler(async (req, res) => {
      const created = await service.submit(requireActor(req), req.body as never);
      res.status(201).json(created);
    }),
  );

  router.get(
    '/me/verifications',
    handler(async (req, res) => {
      res.status(200).json(await service.listMine(requireActor(req), parsePageRequest(req.query)));
    }),
  );

  router.get(
    '/me/memberships',
    handler(async (req, res) => {
      res.status(200).json({ data: await service.listMyMemberships(requireActor(req)) });
    }),
  );

  router.get(
    '/me/subjects',
    handler(async (req, res) => {
      res.status(200).json({ data: await service.listMyTeachingSubjects(requireActor(req)) });
    }),
  );

  router.get(
    '/schools/:id/verifications',
    handler(async (req, res) => {
      res
        .status(200)
        .json(
          await service.listForSchool(
            requireActor(req),
            uuidParam(req, 'id'),
            statusFilter(req.query.status),
            parsePageRequest(req.query),
          ),
        );
    }),
  );

  router.post(
    '/verifications/:id/decision',
    validateBody(verificationDecisionSchema),
    handler(async (req, res) => {
      const updated = await service.decide(
        requireActor(req),
        uuidParam(req, 'id'),
        req.body as never,
      );
      res.status(200).json(updated);
    }),
  );

  router.get(
    '/schools/:id/members',
    handler(async (req, res) => {
      const data = await service.listMembers(requireActor(req), uuidParam(req, 'id'));
      res.status(200).json({ data });
    }),
  );

  router.delete(
    '/schools/:id/members/:accountId',
    handler(async (req, res) => {
      await service.revokeMember(
        requireActor(req),
        uuidParam(req, 'id'),
        uuidParam(req, 'accountId'),
      );
      res.status(204).end();
    }),
  );

  return router;
}
