/**
 * Domain error types and the error catalogue from `.docs/API/02-error-model.md`.
 *
 * Domain code throws these; it never writes HTTP directly. One global error middleware
 * (`shared/middleware/error-handler.ts`) maps them onto the response envelope.
 */

/** Stable machine-readable codes. Clients branch on these, never on `message`. */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
  FORBIDDEN: 'FORBIDDEN',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  SCHOOL_WEB_ONLY: 'SCHOOL_WEB_ONLY',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Field-level issue, populated for 422 responses. */
export interface ErrorDetail {
  field: string;
  issue: string;
}

/** Base class for every error the API deliberately surfaces to a client. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetail[];
  /** Operational errors are expected; anything else is a bug and logged at error level. */
  readonly isOperational = true;

  constructor(code: ErrorCode, status: number, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, new.target);
  }
}

export class ValidationFailedError extends AppError {
  constructor(details: ErrorDetail[], message = 'The request failed validation.') {
    super(ErrorCode.VALIDATION_FAILED, 422, message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super(ErrorCode.UNAUTHENTICATED, 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(ErrorCode.FORBIDDEN, 403, message);
  }
}

export class VerificationRequiredError extends AppError {
  constructor(message = 'You must be a verified member of this context.') {
    super(ErrorCode.VERIFICATION_REQUIRED, 403, message);
  }
}

export class SchoolWebOnlyError extends AppError {
  constructor(message = 'School accounts can only be used on the web.') {
    super(ErrorCode.SCHOOL_WEB_ONLY, 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super(ErrorCode.NOT_FOUND, 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current state.') {
    super(ErrorCode.CONFLICT, 409, message);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests. Please retry later.') {
    super(ErrorCode.RATE_LIMITED, 429, message);
  }
}

export class DependencyUnavailableError extends AppError {
  constructor(message = 'A required dependency is unavailable.') {
    super(ErrorCode.DEPENDENCY_UNAVAILABLE, 503, message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
