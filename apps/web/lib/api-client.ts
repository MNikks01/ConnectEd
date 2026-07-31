/**
 * Typed API client (`.docs/Architecture/03-frontend-architecture.md`).
 *
 * Shapes come from `@connected/types`, which also defines the zod schemas the API validates
 * against — so a response type here cannot drift from what the server actually sends.
 *
 * This module runs **server-side only** (Server Components and route handlers). The browser never
 * calls the API directly; it calls this app's route handlers, which hold the session cookies.
 */
import { ErrorCode, type CurrentAccountResponse, type ErrorEnvelope } from '@connected/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** A failed API call, carrying the machine-readable code clients branch on. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: { field: string; issue: string }[];
  readonly correlationId?: string;

  constructor(envelope: ErrorEnvelope['error']) {
    super(envelope.message);
    this.name = 'ApiError';
    this.code = envelope.code;
    this.status = envelope.status;
    this.details = envelope.details;
    this.correlationId = envelope.correlationId;
  }

  /** True when re-authenticating could plausibly fix it. */
  get isAuthFailure(): boolean {
    return this.code === ErrorCode.UNAUTHENTICATED || this.code === ErrorCode.TOKEN_REUSE_DETECTED;
  }
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  accessToken?: string | undefined;
  /** Forwarded so a browser request and its API call share one id in the logs. */
  correlationId?: string | undefined;
  headers?: Record<string, string>;
  cache?: RequestCache;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken, correlationId, headers = {}, cache } = options;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Identifies this as the web client, which is what the school-web-only rule reads.
      'X-Client-Type': 'web',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    // Authenticated data must never be served from a shared cache.
    cache: cache ?? 'no-store',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(
      (payload as ErrorEnvelope | undefined)?.error ?? {
        code: ErrorCode.INTERNAL,
        message: 'The server could not be reached.',
        status: response.status,
        correlationId: '',
      },
    );
  }

  return payload as T;
}

export function getCurrentAccount(accessToken: string): Promise<CurrentAccountResponse> {
  return apiFetch<CurrentAccountResponse>('/me', { accessToken });
}

export { API_URL };
