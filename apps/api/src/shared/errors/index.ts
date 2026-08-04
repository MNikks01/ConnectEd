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
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  FEATURE_NOT_IN_PLAN: 'FEATURE_NOT_IN_PLAN',
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
  /**
   * Why the token was refused — **for logs only**, never for the response.
   *
   * The client is told one opaque thing on purpose: distinguishing "expired" from "bad signature"
   * from "wrong issuer" tells an attacker which part of a forgery to fix. But an operator staring
   * at a burst of 401s needs exactly that distinction, and it has been unavailable: a token that
   * was refused looked identical to one that was never sent.
   */
  readonly reason?: string;

  constructor(message = 'Authentication is required.', reason?: string) {
    super(ErrorCode.UNAUTHENTICATED, 401, message);
    this.reason = reason;
  }
}

/**
 * A school has run out of what its plan allows — S5-3 (`PRD/08-billing.md`, FR-BILL-003).
 *
 * **This is not an authorization failure and must not read like one.** Every other refusal in this
 * API means the caller tried to do something they were not permitted to do; this one means they
 * were entirely entitled to try and their school has run out of room. So, unlike a scoped 404 or a
 * bare 403, it says exactly what the limit is, how much of it is in use, and what lifts it —
 * hiding that would be both user-hostile and commercially absurd.
 *
 * 402 rather than 403 so a client can branch on "needs a bigger plan" without parsing prose.
 */
export class PlanLimitExceededError extends AppError {
  constructor(params: { limit: string; allowed: number; used: number; planName: string }) {
    super(
      ErrorCode.PLAN_LIMIT_EXCEEDED,
      402,
      `Your ${params.planName} plan allows ${params.allowed} ${params.limit}, and ${params.used} ` +
        `are in use. Upgrading the plan raises the limit; nothing you already have is affected.`,
      [
        {
          field: params.limit,
          issue: `limit ${params.allowed} reached (${params.used} in use)`,
        },
      ],
    );
  }
}

/**
 * The school's plan does not include this feature at all — S6-7 (FR-BILL-003).
 *
 * A sibling of `PlanLimitExceededError` and deliberately not the same code. "You have used all
 * five of your classes" and "your plan has never included this" lead to the same remedy but are
 * different sentences, and a client that cannot tell them apart writes one that is wrong for the
 * other. Both are 402, so a client that only cares about "needs a bigger plan" can branch once.
 */
export class FeatureNotInPlanError extends AppError {
  constructor(params: { feature: string; planName: string; includedIn: string }) {
    super(
      ErrorCode.FEATURE_NOT_IN_PLAN,
      402,
      `Your ${params.planName} plan does not include ${params.feature}. It is part of the ` +
        `${params.includedIn} plan.`,
      [{ field: params.feature, issue: `not included in ${params.planName}` }],
    );
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
