/**
 * Standalone queue worker.
 *
 * The same handler the API can run in-process, as its own process instead. Used when fan-out
 * volume means notification work should not share an event loop with request handling — the API
 * then runs with RUN_WORKER_IN_PROCESS=false so events are consumed exactly once overall.
 */
import { createServer } from 'node:http';

import { loadConfig } from './shared/config/index.js';
import { createDb } from './shared/db/index.js';
import { createLogger } from './shared/logger/index.js';
import {
  createEventQueue,
  createEventWorker,
  createMaintenanceScheduler,
  createRedisConnection,
  EVENTS_QUEUE,
} from './shared/queue/index.js';
import {
  createMetrics,
  registerDbPoolMetrics,
  registerOutboxDepthMetric,
  registerQueueDepthMetrics,
} from './shared/observability/metrics.js';
import { createOutboxRepository, createRelay } from './shared/outbox/index.js';
import { createMediaModule } from './modules/media/index.js';
import { createNotificationsModule } from './modules/notifications/index.js';
import { createStorage } from './shared/storage/index.js';

const config = loadConfig();
const logger = createLogger(config);

const metrics = createMetrics();

const db = createDb({
  connectionString: config.DATABASE_URL,
  logQueries: config.DB_LOG_QUERIES,
  onPool: (pool) => {
    registerDbPoolMetrics(metrics.registry, pool);
  },
});

const connection = createRedisConnection(config.REDIS_URL);
const notifications = createNotificationsModule(db, logger);
const worker = createEventWorker(
  connection,
  logger,
  (event) => notifications.service.handleEvent(event),
  metrics,
);

/**
 * Depth is read through a `Queue`, not the `Worker` — a worker consumes jobs and cannot count
 * them. It gets its own Redis connection for the same reason the API's does: the worker's is
 * blocked on `BRPOPLPUSH` most of the time, and a counting command queued behind that would
 * report a number from whenever the block last cleared.
 */
const countingConnection = createRedisConnection(config.REDIS_URL);
const counting = createEventQueue(countingConnection, logger);

registerQueueDepthMetrics(metrics.registry, { [EVENTS_QUEUE]: counting.queue });

/**
 * The outbox relay (ADR-0019). It lives in the worker rather than the API for the same reason the
 * sweeps do: it is periodic, nobody is waiting on its response, and a request thread should not be
 * competing with it.
 *
 * It reuses the counting connection's `Queue` to enqueue. That connection is not blocked on
 * `BRPOPLPUSH` the way the worker's is, so an `add` here is not sitting behind a long poll.
 */
const outbox = createOutboxRepository(db);

const relay = createRelay({
  repository: outbox,
  // Unlike the old publisher, this throws — the relay needs to know it failed so the row stays.
  enqueue: async (event) => {
    await counting.queue.add(event.type, event, { jobId: event.eventId });
  },
  logger,
});

registerOutboxDepthMetric(metrics.registry, outbox);

relay.start();
logger.info('Outbox relay started');

/**
 * Housekeeping. The orphan sweep lives here rather than in the API: it is slow, periodic, and
 * nobody is waiting for its response.
 */
const media = createMediaModule(createStorage(config, logger), logger, config.MAX_UPLOAD_BYTES, db);

/**
 * Login throttles are swept here too. They expire by time rather than by row — a stale one refuses
 * nobody — so this is tidiness rather than correctness, and it keeps a table an attacker can add
 * rows to from growing without bound.
 */
const { createAuthModule } = await import('./modules/auth/index.js');
const { createPasswordHasher } = await import('./shared/auth/password.js');
const { createTokenService } = await import('./shared/auth/tokens.js');
const { createBillingModule: createBillingForWorker } = await import('./modules/billing/index.js');
const { createMailer } = await import('./shared/mail/index.js');

const auth = createAuthModule({
  db,
  config,
  logger,
  passwords: createPasswordHasher(config),
  tokens: createTokenService(config),
  billing: createBillingForWorker(db, logger).service,
  mailer: createMailer(config.MAIL_TRANSPORT, logger, config.NODE_ENV),
});

const maintenance = createMaintenanceScheduler(
  connection,
  logger,
  {
    'media:sweep-orphans': async () => {
      await media.service.sweepOrphans();
    },
    'auth:sweep-login-throttles': async () => {
      await auth.service.sweepLoginThrottles();
    },
  },
  // Nightly, off the hour. An upload abandoned during the day is collected the following night.
  { 'media:sweep-orphans': '17 3 * * *', 'auth:sweep-login-throttles': '41 3 * * *' },
);

await maintenance.ready;

/**
 * A scrape endpoint and nothing else — no router, no middleware, no API surface.
 *
 * The worker is split out precisely when fan-out is heavy, which is exactly when its lag and
 * failure counts matter most. Without this they would be visible only in the in-process
 * deployment, where they matter least.
 */
const metricsServer = config.METRICS_ENABLED
  ? createServer((req, res) => {
      if (req.url !== '/metrics') {
        res.statusCode = 404;
        res.end();
        return;
      }

      void metrics.registry
        .metrics()
        .then((body) => {
          res.setHeader('Content-Type', metrics.registry.contentType);
          res.end(body);
        })
        .catch(() => {
          res.statusCode = 500;
          res.end();
        });
    }).listen(config.WORKER_METRICS_PORT, () => {
      logger.info({ port: config.WORKER_METRICS_PORT }, 'Worker metrics listening');
    })
  : undefined;

logger.info('Event worker listening');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Worker shutting down');

  // Close the worker first so in-flight jobs finish before the connections go.
  await worker.close();
  // Before `counting` and the database, both of which the relay is holding mid-pass. Stopping it
  // waits for the current pass, so an event already claimed is either handed over or left
  // unpublished for the next process — never marked published without reaching the queue.
  await relay.stop();
  await maintenance.close();
  metricsServer?.close();
  await counting.close();
  await countingConnection.quit();
  await connection.quit();
  await db.$disconnect();

  logger.info('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
