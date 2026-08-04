/**
 * Real-user monitoring ingest — S5-13 (`.docs/Monitoring/00-observability.md`).
 *
 * The only **unauthenticated write** in this API, and it exists because the marketing pages have
 * no session and their load time is exactly what a Core Web Vitals dashboard is for. Everything
 * about it is shaped by that:
 *
 * - **It stores nothing.** The body becomes a histogram observation and is discarded. There is no
 *   row for an attacker to fill, and nothing here can be read back.
 * - **The path never becomes a label.** `route` is derived by the server from a closed list of
 *   patterns; anything unrecognised collapses to `other`. A label taken from a URL is one time
 *   series per URL, and a stranger who can mint labels can run up a metrics bill without ever
 *   touching the product.
 * - **It answers 204 whatever happens.** A monitoring endpoint that reports its own failures to
 *   the browser teaches the browser to retry, and a retry storm from every visitor is a far worse
 *   outcome than a lost measurement.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { rumBatchSchema } from '@connected/types';

import type { Config } from '../shared/config/index.js';
import type { Logger } from '../shared/logger/index.js';
import type { Metrics } from '../shared/observability/metrics.js';
import type { Request, Response, Router as ExpressRouter } from 'express';

/**
 * Every route the web app serves, as a pattern.
 *
 * A closed list rather than a clever normaliser: a regex that turns ids into `:id` still admits
 * whatever else a caller invents, and the point is a *bounded* set. Adding a page here is a
 * deliberate act, which is the same bar the endpoint catalogue holds.
 */
const KNOWN_ROUTES = [
  '/',
  '/about',
  '/contact',
  '/login',
  '/register',
  '/register/school',
  '/home',
  '/social',
  '/connections',
  '/messages',
  '/messages/:id',
  '/notifications',
  '/accounts/:id',
  '/settings/profile',
  '/classes/:id',
  '/classes/:id/subjects/:id',
  '/notices',
  '/events',
  '/leave',
  '/complaints',
  '/school',
  '/school/classes',
  '/school/classes/:id',
  '/school/notices',
  '/school/events',
  '/school/complaints',
  '/school/members',
  '/school/verifications',
  '/school/billing',
] as const;

const KNOWN = new Set<string>(KNOWN_ROUTES);

/** UUIDs and numeric ids collapse to `:id`; anything still unknown collapses to `other`. */
export function routeLabelFor(path: string): string {
  const pathname = path.split('?')[0]?.split('#')[0] ?? '/';

  const templated =
    pathname
      .split('/')
      .map((segment) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
        /^\d+$/.test(segment)
          ? ':id'
          : segment,
      )
      .join('/') || '/';

  const normalised = templated.length > 1 ? templated.replace(/\/$/, '') : templated;

  return KNOWN.has(normalised) ? normalised : 'other';
}

export interface RumRoutesDeps {
  metrics: Metrics;
  config: Config;
  logger: Logger;
}

export function rumRoutes({ metrics, config, logger }: RumRoutesDeps): ExpressRouter {
  const router = Router();

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    // A page load reports at most one batch, and a busy office shares one address. Generous
    // enough for a school behind a single NAT, small enough to bound a single abuser.
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !config.RATE_LIMIT_ENABLED,
    // 204 rather than 429: the browser must not learn to retry.
    handler: (_req: Request, res: Response) => {
      res.status(204).end();
    },
  });

  router.post('/rum', limiter, (req: Request, res: Response) => {
    const parsed = rumBatchSchema.safeParse(req.body);

    if (!parsed.success) {
      // Deliberately not a 422. A malformed beacon is a bug in a page nobody is watching, not
      // something the visitor can act on, and telling them invites a retry loop.
      res.status(204).end();
      return;
    }

    for (const vital of parsed.data.vitals ?? []) {
      const route = routeLabelFor(vital.path);

      if (vital.name === 'CLS') {
        // Unitless: observed as reported, into its own metric.
        metrics.webVitalCls.observe({ route }, vital.value);
      } else {
        metrics.webVitalDuration.observe({ metric: vital.name, route }, vital.value / 1000);
      }
    }

    for (const error of parsed.data.errors ?? []) {
      const route = routeLabelFor(error.path);
      metrics.webErrors.inc({ route });
      // The message reaches the logs and never a label — it is attacker-controlled and unbounded.
      logger.warn({ route, message: error.message }, 'Browser error reported');
    }

    res.status(204).end();
  });

  return router;
}
