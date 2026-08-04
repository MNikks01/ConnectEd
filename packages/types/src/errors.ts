/**
 * The API error envelope (`.docs/API/02-error-model.md`), typed for clients.
 *
 * Clients branch on `code`, never on `message` — messages are human-facing copy and will change.
 */

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
  RATE_LIMITED: 'RATE_LIMITED',
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorDetail {
  field: string;
  issue: string;
}

export interface ErrorEnvelope {
  error: {
    /**
     * A known code, or any string. The open union keeps autocomplete for the catalogue while
     * letting a client compile against an API that has since added a code it does not know.
     */
    code: ErrorCode | (string & {});
    message: string;
    status: number;
    /** Quote this to support; it ties the response to server logs and traces. */
    correlationId: string;
    details?: ErrorDetail[];
  };
}
