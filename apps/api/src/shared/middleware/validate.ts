/**
 * Request validation — every external input is parsed by a zod schema before a handler sees it
 * (`apps/api/CLAUDE.md` rule 4).
 *
 * The handler receives the *parsed* value, not the raw one, so unknown keys are stripped and
 * coercions have already happened. That is what stops mass-assignment: a client cannot smuggle
 * `role: 'PRINCIPAL'` into a registration body and have it reach a repository.
 */
import { ZodError, type ZodType } from 'zod';

import { ValidationFailedError } from '../errors/index.js';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(toValidationError(error));
    }
  };
}

function toValidationError(error: unknown): unknown {
  if (!(error instanceof ZodError)) return error;

  return new ValidationFailedError(
    error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      issue: issue.message,
    })),
  );
}
