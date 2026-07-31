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

// Readiness checks register here as their dependencies land:
//   readiness.register({ name: 'postgres', probe: () => prisma.$queryRaw`SELECT 1` })  // S0-6
const app = createApp({ config, logger });

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
