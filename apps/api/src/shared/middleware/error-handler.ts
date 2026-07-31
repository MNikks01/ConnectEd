/**
 * The single global error middleware (`.docs/API/02-error-model.md`).
 *
 * Everything the API returns as an error passes through here, so the envelope is guaranteed to be
 * consistent. 5xx bodies never carry stack traces, SQL, or driver messages — those go to the logs
 * keyed by `correlationId`, which the client receives and can quote to support.
 */
import { ZodError } from 'zod';

import { AppError, ErrorCode, isAppError, type ErrorDetail } from '../errors/index.js';
import { logger } from '../logger/index.js';

import type { NextFunction, Request, Response } from 'express';

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    status: number;
    correlationId: string;
    details?: ErrorDetail[];
  };
}

function zodToDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    issue: issue.message,
  }));
}

/** Normalizes anything thrown into an AppError without leaking internals to the client. */
function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  // Schemas that escape a route's own validation still deserve a proper 422.
  if (error instanceof ZodError) {
    return new AppError(
      ErrorCode.VALIDATION_FAILED,
      422,
      'The request failed validation.',
      zodToDetails(error),
    );
  }

  // Express' body parser rejects malformed JSON with a 400-tagged SyntaxError.
  if (error instanceof SyntaxError && 'body' in error) {
    return new AppError(ErrorCode.VALIDATION_FAILED, 400, 'The request body is not valid JSON.');
  }

  return new AppError(ErrorCode.INTERNAL, 500, 'An unexpected error occurred.');
}

export function errorHandler() {
  return (error: unknown, req: Request, res: Response, next: NextFunction): void => {
    // Express cannot rewrite headers once streaming has begun; hand back to its default handler.
    if (res.headersSent) {
      next(error);
      return;
    }

    const appError = toAppError(error);
    const correlationId = req.correlationId;

    const logContext = {
      correlationId,
      code: appError.code,
      status: appError.status,
      method: req.method,
      path: req.path,
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
