/**
 * Structured JSON logging (pino) — shipped to Loki and correlated by `correlationId`/`traceId`.
 *
 * Never log passwords, tokens, or PII (`apps/api/CLAUDE.md` rule 7). The redaction list is a
 * backstop for the common carriers, not a licence to pass sensitive values into log context.
 */
import { pino, type Logger as PinoLogger } from 'pino';

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
    // Pretty output is a developer convenience only; production emits raw JSON for the pipeline.
    transport: config.isProduction
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },
  });
}
