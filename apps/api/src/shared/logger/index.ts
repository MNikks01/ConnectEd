/**
 * Structured JSON logging (pino) — shipped to Loki and correlated by `correlationId`/`traceId`.
 *
 * Never log passwords, tokens, or PII (`apps/api/CLAUDE.md` rule 7). The redaction list below is a
 * backstop for the common carriers, not a licence to pass sensitive values into log context.
 */
import { pino } from 'pino';

import { config } from '../config/index.js';

export const logger = pino({
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
  // Pretty output is a developer convenience only; production emits raw JSON for the log pipeline.
  transport: config.isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true } },
});

export type Logger = typeof logger;
