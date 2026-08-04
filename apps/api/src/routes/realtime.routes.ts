/**
 * The one HTTP endpoint the realtime channel needs (`.docs/API/03-endpoints.md`).
 *
 * `POST /me/realtime-ticket` — the caller proves who they are the ordinary way, with a bearer
 * token, and gets back a string that authorizes exactly one WebSocket upgrade within thirty
 * seconds. `/me/*` because the answer is about the caller and nothing else (`API/01-conventions.md`).
 *
 * It is a POST despite reading nothing, because it *creates* a credential. A GET that mints one
 * would be fetchable by a cross-origin page, cacheable by a proxy, and replayable from history.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { requireActor } from '../shared/middleware/authenticate.js';
import { ErrorCode } from '../shared/errors/index.js';

import type { Config } from '../shared/config/index.js';
import type { Realtime } from '../shared/realtime/index.js';
import type { Router as ExpressRouter } from 'express';

export function realtimeRoutes(realtime: Realtime, config: Config): ExpressRouter {
  const router = Router();

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    // A tab reconnects with backoff, so a healthy client needs a handful a minute at most. This
    // is high enough for a person with several tabs and a flaky train connection, and low enough
    // that a loop cannot mint thousands of live credentials.
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => requireActor(req).accountId,
    skip: () => !config.RATE_LIMIT_ENABLED,
    message: {
      error: {
        code: ErrorCode.RATE_LIMITED,
        message: 'Too many connection attempts. Wait a moment and try again.',
        status: 429,
      },
    },
  });

  router.post('/me/realtime-ticket', limiter, (req, res) => {
    void realtime
      .issueTicket(requireActor(req).accountId)
      .then((ticket) => {
        res.status(201).json(ticket);
      })
      .catch((error: unknown) => {
        // Redis being down must not take messaging with it — the client falls back to reading.
        res.app.emit('realtime-ticket-error', error);
        res.status(503).json({
          error: {
            code: ErrorCode.DEPENDENCY_UNAVAILABLE,
            message: 'Live updates are unavailable right now.',
            status: 503,
            correlationId: req.correlationId,
          },
        });
      });
  });

  return router;
}
