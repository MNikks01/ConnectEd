/**
 * The single global error middleware (`.docs/API/02-error-model.md`).
 *
 * Its one job is the HTTP concern: decide status, log, and write the envelope. Deciding *what* a
 * thrown value means lives in `errors/mapping.ts`, so adding support for a new error source does
 * not touch this file.
 *
 * 5xx bodies never carry stack traces, SQL, or driver messages — those go to the logs keyed by
 * `correlationId`, which the client receives and can quote to support.
 */
import { createErrorNormalizer } from '../errors/mapping.js';

import { UnauthenticatedError } from '../errors/index.js';

import type { ErrorDetail } from '../errors/index.js';
import type { ErrorMapper } from '../errors/mapping.js';
import type { ErrorLogger } from '../logger/index.js';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    status: number;
    correlationId: string;
    details?: ErrorDetail[];
  };
}

export interface ErrorHandlerOptions {
  logger: ErrorLogger;
  /** Extra mappers for foreign error types; defaults cover zod and malformed JSON. */
  mappers?: readonly ErrorMapper[];
}

export function errorHandler({ logger, mappers }: ErrorHandlerOptions): ErrorRequestHandler {
  const normalize = createErrorNormalizer(mappers);

  return (error: unknown, req: Request, res: Response, next: NextFunction): void => {
    // Express cannot rewrite headers once streaming has begun; hand back to its default handler.
    if (res.headersSent) {
      next(error);
      return;
    }

    const appError = normalize(error);
    const correlationId = req.correlationId;

    const logContext = {
      correlationId,
      code: appError.code,
      status: appError.status,
      method: req.method,
      path: req.path,
      // Present only on 401s that carry one. A burst of them reading "JWTExpired" is a different
      // incident from a burst reading "JWSSignatureVerificationFailed", and until now the logs
      // could not tell the two apart.
      ...(appError instanceof UnauthenticatedError && appError.reason
        ? { reason: appError.reason }
        : {}),
    };

    if (appError.status >= 500) {
      // Unexpected: keep the original error so the stack reaches the logs (never the response).
      logger.error({ ...logContext, err: error }, 'Request failed');
    } else {
      // Expected client errors (404s from scanners, 401s from expired tokens) are high volume.
      // A stack trace per occurrence buys nothing and would dominate log spend.
      logger.warn(logContext, 'Request rejected');
    }

    const envelope: ErrorEnvelope = {
      error: {
        code: appError.code,
        message: appError.message,
        status: appError.status,
        correlationId,
        ...(appError.details ? { details: appError.details } : {}),
      },
    };

    res.status(appError.status).json(envelope);
  };
}
