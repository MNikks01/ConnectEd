/**
 * Correlation id — one id pivots across logs, metrics, and traces (`.docs/Monitoring/00-observability.md`).
 *
 * Accepts an inbound `X-Correlation-Id` so a request can be followed across web → api, and always
 * echoes the id back so clients can quote it in support requests.
 */
import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Inbound ids are attacker-controlled, so cap length and strip anything unusual before logging it. */
function sanitize(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 128) return undefined;
  return /^[\w.:-]+$/.test(trimmed) ? trimmed : undefined;
}

export function correlationId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const inbound = req.get(CORRELATION_ID_HEADER);
    req.correlationId = (inbound ? sanitize(inbound) : undefined) ?? randomUUID();
    res.setHeader(CORRELATION_ID_HEADER, req.correlationId);
    next();
  };
}
