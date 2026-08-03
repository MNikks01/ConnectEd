/**
 * API entrypoint: build the dependency graph, start tracing, bind the server, shut down cleanly.
 *
 * The tracing import is deliberately first and the rest are dynamic — OpenTelemetry patches
 * libraries at import time, so it has to run before Express and friends load. Static imports are
 * hoisted and would defeat that.
 */
import { startTracing } from './shared/observability/tracing.js';

const { loadConfig } = await import('./shared/config/index.js');
const { createLogger } = await import('./shared/logger/index.js');

const config = loadConfig();
const tracing = startTracing(config);
const logger = createLogger(config);

const { createApp } = await import('./app.js');
const { createDb, registerDbReadiness } = await import('./shared/db/index.js');
const { ReadinessRegistry } = await import('./shared/health/readiness.js');
const { createEventQueue, createEventWorker, createRedisConnection } =
  await import('./shared/queue/index.js');
const { createNotificationsModule } = await import('./modules/notifications/index.js');
const { createStorage } = await import('./shared/storage/index.js');

const db = createDb({
  connectionString: config.DATABASE_URL,
  logQueries: config.DB_LOG_QUERIES,
});

// BullMQ needs its own connection: a blocking worker command would otherwise stall every other
// Redis call sharing the socket.
const queueConnection = createRedisConnection(config.REDIS_URL);
const events = createEventQueue(queueConnection, logger);

// Dependencies register their own readiness probes here, at the composition root.
const readiness = new ReadinessRegistry();
registerDbReadiness(readiness, db);
readiness.register({ name: 'redis', probe: () => events.ping() });

const storage = createStorage(config, logger);
// Local convenience; deployed buckets come from Terraform with their policies attached.
await storage.ensureBucket();
readiness.register({ name: 'object-storage', probe: () => storage.ping() });

/**
 * The plan catalogue is code (`modules/billing/plan-catalogue.ts`); the table is its projection.
 * Applying it at boot — idempotently, like the bucket above — means "the plans exist" holds in
 * every environment without anyone remembering to run a script, and school registration cannot
 * fail for want of a row.
 */
const { createBillingModule } = await import('./modules/billing/index.js');
const billing = createBillingModule(db, logger);
await billing.service.ensureCatalogue();

const app = createApp({ config, logger, readiness, db, events: events.publisher, storage });

/**
 * The worker consumes what the API publishes. In-process by default; a separate process when
 * RUN_WORKER_IN_PROCESS is false, so fan-out cannot compete with request handling.
 */
const { createVerificationModule } = await import('./modules/verification/index.js');
const verificationForWorker = createVerificationModule(
  db,
  logger,
  events.publisher,
  billing.service,
);
const notifications = createNotificationsModule(db, logger, verificationForWorker.service);
const workerConnection = config.RUN_WORKER_IN_PROCESS
  ? createRedisConnection(config.REDIS_URL)
  : undefined;
const worker = workerConnection
  ? createEventWorker(workerConnection, logger, (event) => notifications.service.handleEvent(event))
  : undefined;

if (worker) logger.info('Event worker running in-process');

const server = app.listen(config.API_PORT, () => {
  logger.info({ port: config.API_PORT, env: config.NODE_ENV }, 'ConnectEd API listening');
});

/**
 * Graceful shutdown: stop accepting connections, let in-flight requests finish, then flush traces.
 * Orchestrators send SIGTERM before SIGKILL, so this window is what prevents dropped requests
 * during a rolling deploy.
 */
const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  // Do not let the timer itself hold the event loop open.
  forceExit.unref();

  server.close(() => {
    void (async () => {
      // Close in dependency order: stop consuming, stop publishing, then release the pool —
      // all only after in-flight requests have drained.
      await worker?.close();
      await events.close();
      await queueConnection.quit();
      await workerConnection?.quit();
      await db.$disconnect();
      await tracing.stop();
      logger.info('Shutdown complete');
      process.exit(0);
    })();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A rejection or exception reaching here means a bug escaped its handler. Log it with the stack and
// exit — process state is no longer trustworthy, and the orchestrator will restart us.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});
