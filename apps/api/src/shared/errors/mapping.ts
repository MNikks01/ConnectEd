/**
 * Translation from arbitrary thrown values to `AppError`.
 *
 * Each source of foreign errors contributes a mapper instead of adding a branch to one growing
 * if-chain: S0-6 adds a Prisma mapper, S0-7 a JWT mapper, and neither edits this file. Mappers are
 * passed to the error middleware at the composition root, so there is no global mutable registry.
 */
import { ZodError } from 'zod';

import { AppError, ErrorCode, isAppError, type ErrorDetail } from './index.js';

/** Returns an AppError if it recognises the value, otherwise `undefined` to pass it along. */
export type ErrorMapper = (error: unknown) => AppError | undefined;

function zodToDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    issue: issue.message,
  }));
}

/** Schemas that escape a route's own validation still deserve a proper 422. */
export const zodErrorMapper: ErrorMapper = (error) =>
  error instanceof ZodError
    ? new AppError(
        ErrorCode.VALIDATION_FAILED,
        422,
        'The request failed validation.',
        zodToDetails(error),
      )
    : undefined;

/** Express' body parser rejects malformed JSON with a SyntaxError carrying a `body` property. */
export const jsonSyntaxErrorMapper: ErrorMapper = (error) =>
  error instanceof SyntaxError && 'body' in error
    ? new AppError(ErrorCode.VALIDATION_FAILED, 400, 'The request body is not valid JSON.')
    : undefined;

export const defaultErrorMappers: readonly ErrorMapper[] = [zodErrorMapper, jsonSyntaxErrorMapper];

/**
 * Builds the normalizer used by the error middleware. Anything unrecognised becomes a generic
 * 500 — the fallback is deliberately opaque so driver text, SQL, and stack traces cannot reach a
 * client through an unmapped error type.
 */
export function createErrorNormalizer(
  mappers: readonly ErrorMapper[] = defaultErrorMappers,
): (error: unknown) => AppError {
  return (error: unknown): AppError => {
    if (isAppError(error)) return error;

    for (const mapper of mappers) {
      const mapped = mapper(error);
      if (mapped) return mapped;
    }

    return new AppError(ErrorCode.INTERNAL, 500, 'An unexpected error occurred.');
  };
}
