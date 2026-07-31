/**
 * Express application factory.
 *
 * Separate from `index.ts` on purpose: tests build an app without binding a port or starting the
 * tracing SDK. Middleware order matters and is documented inline.
 */
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { healthRoutes } from './routes/health.routes.js';
import { config } from './shared/config/index.js';
import { logger } from './shared/logger/index.js';
import { correlationId } from './shared/middleware/correlation-id.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { notFound } from './shared/middleware/not-found.js';
import { httpMetrics } from './shared/observability/metrics.js';

export const API_PREFIX = '/api/v1';

export function createApp(): Express {
  const app = express();

  // Behind a load balancer / ingress: trust the proxy so req.ip and rate limiting see the
  // real client address rather than the hop in front of us.
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: config.WEB_ORIGIN,
      // The refresh token travels as an httpOnly cookie (ADR-0007).
      credentials: true,
    }),
  );

  // Correlation id comes before logging and metrics so both can reference it.
  app.use(correlationId());
  app.use(httpMetrics());
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ correlationId: (req as express.Request).correlationId }),
      // Probes and scrapes would otherwise dominate the log volume.
      autoLogging: {
        ignore: (req) => ['/healthz', '/readyz', '/metrics'].includes(req.url ?? ''),
      },
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Operational endpoints are unversioned; product routes live under /api/v1.
  app.use(healthRoutes());

  const api = express.Router();
  // Module routers mount here as they land: auth, accounts, institution, … (S0-7 onward).
  app.use(API_PREFIX, api);

  // Order is load-bearing: unmatched → 404 error, then the single global error handler.
  app.use(notFound());
  app.use(errorHandler());

  return app;
}
