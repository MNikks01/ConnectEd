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
  registerQueueDepthMetrics,
} from './shared/observability/metrics.js';
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
 * Housekeeping. The orphan sweep lives here rather than in the API: it is slow, periodic, and
 * nobody is waiting for its response.
 */
const media = createMediaModule(createStorage(config, logger), logger, config.MAX_UPLOAD_BYTES, db);

const maintenance = createMaintenanceScheduler(
  connection,
  logger,
  {
    'media:sweep-orphans': async () => {
      await media.service.sweepOrphans();
    },
  },
  // Nightly, off the hour. An upload abandoned during the day is collected the following night.
  { 'media:sweep-orphans': '17 3 * * *' },
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
