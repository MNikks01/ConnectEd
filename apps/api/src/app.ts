/**
 * Composition root: the one place that knows which concrete config, logger, registry, metrics, and
 * database the app runs with. Everything else receives what it needs, which is what keeps the
 * modules testable and lets later modules add dependencies without editing the pieces they plug
 * into.
 *
 * Separate from `index.ts` on purpose: tests build an app without binding a port or starting the
 * tracing SDK. Middleware order matters and is documented inline.
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { createAuthModule } from './modules/auth/index.js';
import { createAnalyticsModule } from './modules/analytics/index.js';
import { createBillingModule } from './modules/billing/index.js';
import { createInstitutionModule } from './modules/institution/index.js';
import { createAcademicsModule } from './modules/academics/index.js';
import { createMediaModule } from './modules/media/index.js';
import { createNotificationsModule } from './modules/notifications/index.js';
import { createSocialModule } from './modules/social/index.js';
import { createVerificationModule } from './modules/verification/index.js';
import { createWorkflowsModule } from './modules/workflows/index.js';
import { healthRoutes } from './routes/health.routes.js';
import { realtimeRoutes } from './routes/realtime.routes.js';
import { rumRoutes } from './routes/rum.routes.js';
import { jwksRoutes } from './routes/jwks.routes.js';
import { createPasswordHasher } from './shared/auth/password.js';
import { createTokenService } from './shared/auth/tokens.js';
import { loadConfig, type Config } from './shared/config/index.js';
import { ReadinessRegistry } from './shared/health/readiness.js';
import { createLogger, type Logger } from './shared/logger/index.js';
import { authenticate } from './shared/middleware/authenticate.js';
import { correlationId } from './shared/middleware/correlation-id.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { notFound } from './shared/middleware/not-found.js';
import { createMetrics, type Metrics } from './shared/observability/metrics.js';
import type { Realtime } from './shared/realtime/index.js';

import { noopPublisher, type EventPublisher } from './shared/events/index.js';

import type { Db } from './shared/db/index.js';
import type { Storage } from './shared/storage/index.js';
import type { ErrorMapper } from './shared/errors/mapping.js';

export const API_PREFIX = '/api/v1';

export interface AppDependencies {
  config: Config;
  logger: Logger;
  metrics: Metrics;
  /**
   * Live delivery. Optional, and absent in most tests: the REST surface is complete without it,
   * and a websocket channel that becomes load-bearing has stopped being an optimisation.
   */
  realtime?: Realtime;
  readiness: ReadinessRegistry;
  /**
   * Optional so a test can build an app for middleware-level assertions without a database.
   * Routes that need persistence are simply not mounted when it is absent.
   */
  db?: Db | undefined;
  /**
   * Where domain events go. Defaults to a no-op so an app can be built without Redis — tests and
   * the health-only configuration both rely on that.
   */
  events?: EventPublisher;
  /** Object storage. Optional so an app can be built without MinIO; media routes are then absent. */
  storage?: Storage | undefined;
  /** Mappers for foreign error types; zod and malformed JSON are covered by default. */
  errorMappers?: readonly ErrorMapper[];
}

/**
 * Builds the default dependency set. Callers override individual pieces (a stub registry, a silent
 * logger) without having to construct the rest.
 */
export function createDependencies(overrides: Partial<AppDependencies> = {}): AppDependencies {
  const config = overrides.config ?? loadConfig();

  return {
    config,
    logger: overrides.logger ?? createLogger(config),
    metrics: overrides.metrics ?? createMetrics(),
    readiness: overrides.readiness ?? new ReadinessRegistry(),
    db: overrides.db,
    events: overrides.events ?? noopPublisher,
    storage: overrides.storage,
    realtime: overrides.realtime,
    errorMappers: overrides.errorMappers,
  };
}

export function createApp(overrides: Partial<AppDependencies> = {}): Express {
  const { config, logger, metrics, readiness, db, events, storage, realtime, errorMappers } =
    createDependencies(overrides);

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
  app.use(metrics.middleware);
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
  app.use(cookieParser());

  const tokens = createTokenService(config);

  // Operational endpoints are unversioned; product routes live under /api/v1.
  app.use(healthRoutes({ readiness, metrics, metricsEnabled: config.METRICS_ENABLED }));

  // Only when there is a public half to publish. See the note in the route module.
  if (config.jwtAsymmetric) {
    app.use(jwksRoutes(tokens));
  }

  const api = express.Router();

  // Before `authenticate`: the marketing pages have no session, and their load time is exactly
  // what a Core Web Vitals dashboard exists to show.
  api.use(rumRoutes({ metrics, config, logger }));

  if (db) {
    const passwords = createPasswordHasher(config);

    // Billing is constructed before auth: registering a school must create its trial in the same
    // statement (FR-BILL-001), so auth needs billing's terms to hand.
    const billing = createBillingModule(db, logger);

    api.use(
      createAuthModule({ db, config, logger, passwords, tokens, billing: billing.service }).routes,
    );

    // Everything past auth requires a valid token; each module still authorizes per resource.
    // Verification owns membership, and institution needs to ask it whether an account is a
    // verified teacher — so it is constructed first and its service passed in as a narrow port.
    const verification = createVerificationModule(
      db,
      logger,
      events ?? noopPublisher,
      billing.service,
    );
    const institution = createInstitutionModule(db, verification.service, billing.service);
    // Notifications resolves class recipients through verification, which owns membership.
    const notifications = createNotificationsModule(db, logger, verification.service);
    // Media only exists when storage was supplied; without it the routes are simply absent
    // rather than present and failing.
    const media = storage
      ? createMediaModule(storage, logger, config.MAX_UPLOAD_BYTES, db)
      : undefined;

    const academics = createAcademicsModule({
      db,
      storage,
      events: events ?? noopPublisher,
      logger,
      // So an attached image stops looking like an abandoned upload.
      media: media?.service,
    });

    const workflows = createWorkflowsModule({ db, events: events ?? noopPublisher, logger });
    const social = createSocialModule({
      db,
      config,
      storage,
      logger,
      media: media?.service,
      presence: realtime,
    });

    api.use(
      authenticate(tokens),
      institution.routes,
      verification.routes,
      notifications.routes,
      academics.routes,
      workflows.routes,
      social.routes,
      billing.routes,
      createAnalyticsModule(db, billing.service).routes,
      ...(realtime ? [realtimeRoutes(realtime, config)] : []),
      ...(media ? [media.routes] : []),
    );
  }

  app.use(API_PREFIX, api);

  // Order is load-bearing: unmatched → 404 error, then the single global error handler.
  app.use(notFound());
  app.use(errorHandler({ logger, mappers: errorMappers }));

  return app;
}
