/**
 * Structured JSON logging (pino) — shipped to Loki and correlated by `correlationId`/`traceId`.
 *
 * Never log passwords, tokens, or PII (`apps/api/CLAUDE.md` rule 7). The redaction list is a
 * backstop for the common carriers, not a licence to pass sensitive values into log context.
 */
import {
  pino,
  type Logger as PinoLogger,
  type TransportMultiOptions,
  type TransportTargetOptions,
} from 'pino';

import type { Config } from '../config/index.js';

export type Logger = PinoLogger;

/**
 * Consumers depend on the narrowest slice they use rather than the whole pino surface, so a test
 * can pass a two-method fake instead of a logger.
 */
export type ErrorLogger = Pick<Logger, 'warn' | 'error'>;

export function createLogger(config: Config): Logger {
  return pino({
    level: config.LOG_LEVEL,
    base: { service: config.OTEL_SERVICE_NAME },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
      ],
      censor: '[redacted]',
    },
    transport: transportFor(config),
  });
}

/**
 * Production writes raw JSON to stdout and lets the platform's collector take it from there —
 * that is the arrangement with the fewest moving parts and no delivery state inside the process.
 *
 * Locally the API runs on the host rather than in compose, so nothing collects its stdout. When
 * `LOKI_URL` is set, logs are shipped directly alongside the pretty console output, which is what
 * makes the Grafana log panel show real traffic during development.
 */
function transportFor(config: Config): TransportMultiOptions | undefined {
  if (config.isProduction) return undefined;

  const targets: TransportTargetOptions[] = [
    { target: 'pino-pretty', options: { colorize: true }, level: config.LOG_LEVEL },
  ];

  if (config.LOKI_URL) {
    targets.push({
      target: 'pino-loki',
      level: config.LOG_LEVEL,
      options: {
        host: config.LOKI_URL,
        labels: { service: config.OTEL_SERVICE_NAME, environment: config.NODE_ENV },
        // Batching keeps log shipping off the request path; a local run does not need it tight.
        batching: true,
        interval: 2,
        // Loki being down must never take the API with it.
        silenceErrors: true,
      },
    });
  }

  return { targets };
}
