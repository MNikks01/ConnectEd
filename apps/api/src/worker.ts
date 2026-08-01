/**
 * Standalone queue worker.
 *
 * The same handler the API can run in-process, as its own process instead. Used when fan-out
 * volume means notification work should not share an event loop with request handling — the API
 * then runs with RUN_WORKER_IN_PROCESS=false so events are consumed exactly once overall.
 */
import { loadConfig } from './shared/config/index.js';
import { createDb } from './shared/db/index.js';
import { createLogger } from './shared/logger/index.js';
import { createEventWorker, createRedisConnection } from './shared/queue/index.js';
import { createNotificationsModule } from './modules/notifications/index.js';

const config = loadConfig();
const logger = createLogger(config);

const db = createDb({
  connectionString: config.DATABASE_URL,
  logQueries: config.DB_LOG_QUERIES,
});

const connection = createRedisConnection(config.REDIS_URL);
const notifications = createNotificationsModule(db, logger);
const worker = createEventWorker(connection, logger, (event) =>
  notifications.service.handleEvent(event),
);

logger.info('Event worker listening');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Worker shutting down');

  // Close the worker first so in-flight jobs finish before the connections go.
  await worker.close();
  await connection.quit();
  await db.$disconnect();

  logger.info('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
