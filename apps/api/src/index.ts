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
const { createEventQueue, createEventWorker, createRedisConnection, EVENTS_QUEUE } =
  await import('./shared/queue/index.js');
const { createNotificationsModule } = await import('./modules/notifications/index.js');
const { createStorage } = await import('./shared/storage/index.js');

const {
  createMetrics,
  registerDbPoolMetrics,
  registerOutboxDepthMetric,
  registerQueueDepthMetrics,
} = await import('./shared/observability/metrics.js');
const { createOutboxRepository, createRelay } = await import('./shared/outbox/index.js');

// Built here rather than inside createApp so the pool, the queue, and the worker can all report
// into the same registry — /metrics is one endpoint, and a signal that lands in a second registry
// is a signal nobody scrapes.
const metrics = createMetrics();

const db = createDb({
  connectionString: config.DATABASE_URL,
  logQueries: config.DB_LOG_QUERIES,
  onPool: (pool) => {
    registerDbPoolMetrics(metrics.registry, pool);
  },
});

// BullMQ needs its own connection: a blocking worker command would otherwise stall every other
// Redis call sharing the socket.
const queueConnection = createRedisConnection(config.REDIS_URL);
const events = createEventQueue(queueConnection);

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

registerQueueDepthMetrics(metrics.registry, { [EVENTS_QUEUE]: events.queue });

/**
 * Live delivery (FR-SOC-022). Two more Redis connections, and both are necessary: ioredis refuses
 * ordinary commands on a client in subscriber mode, so a single shared one would make ticket
 * issuance throw the moment the first socket connected.
 */
const { createRealtime } = await import('./shared/realtime/index.js');
const realtimeConnection = createRedisConnection(config.REDIS_URL);
const realtimeSubscriber = createRedisConnection(config.REDIS_URL);
const realtime = createRealtime({
  redis: realtimeConnection,
  subscriber: realtimeSubscriber,
  logger,
});

const app = createApp({
  config,
  logger,
  metrics,
  readiness,
  db,
  storage,
  realtime,
});

/**
 * The worker consumes what the API publishes. In-process by default; a separate process when
 * RUN_WORKER_IN_PROCESS is false, so fan-out cannot compete with request handling.
 */
const { createVerificationModule } = await import('./modules/verification/index.js');
const verificationForWorker = createVerificationModule(db, logger, billing.service);
const notifications = createNotificationsModule(db, logger, verificationForWorker.service);
const workerConnection = config.RUN_WORKER_IN_PROCESS
  ? createRedisConnection(config.REDIS_URL)
  : undefined;
const worker = workerConnection
  ? createEventWorker(
      workerConnection,
      logger,
      (event) => notifications.service.handleEvent(event),
      metrics,
    )
  : undefined;

if (worker) logger.info('Event worker running in-process');

/**
 * The outbox relay runs wherever the worker does (ADR-0019). In-process by default, so a local
 * `pnpm dev` delivers notifications without a second process; when `RUN_WORKER_IN_PROCESS` is
 * false it belongs to the worker instead, and running it in both would have two relays claiming
 * from the same table — which `FOR UPDATE SKIP LOCKED` makes safe, but pointless.
 */
const outbox = createOutboxRepository(db);

const relay = config.RUN_WORKER_IN_PROCESS
  ? createRelay({
      repository: outbox,
      enqueue: events.enqueue,
      logger,
    })
  : undefined;

registerOutboxDepthMetric(metrics.registry, outbox);

if (relay) {
  relay.start();
  logger.info('Outbox relay running in-process');
}

const server = app.listen(config.API_PORT, () => {
  logger.info({ port: config.API_PORT, env: config.NODE_ENV }, 'ConnectEd API listening');
});

// After `listen`, because the upgrade handler binds to the running server.
realtime.attach(server);

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
      // Before the queue and the pool it is mid-pass against; see the worker's shutdown.
      await relay?.stop();
      // Sockets first: an open connection would otherwise keep the process alive past the point
      // the load balancer has already stopped sending it work.
      await realtime.close();
      await realtimeConnection.quit();
      await realtimeSubscriber.quit();
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
