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

/**
 * Where the API is, from **this server's** point of view.
 *
 * `API_URL` first, and it is the one that matters in a container. `NEXT_PUBLIC_*` values are
 * inlined into the bundle at build time, so an image built with one is pinned to the API it was
 * built against — staging and production would need different images of identical code. This
 * module is server-side only (see above), so it does not need a public variable at all, and a
 * plain one is read at runtime where an environment can still set it.
 *
 * The public variable stays as a fallback because the E2E suite and every local `.env` set it, and
 * breaking those to fix a deployment nobody has yet would be the wrong trade.
 */
const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

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
  /**
   * JSON by default. Pass a `FormData` and it is forwarded as multipart instead — `fetch` sets the
   * boundary itself, which is why the JSON content type has to be *omitted* rather than replaced.
   */
  body?: unknown;
  accessToken?: string | undefined;
  /** Forwarded so a browser request and its API call share one id in the logs. */
  correlationId?: string | undefined;
  headers?: Record<string, string>;
  cache?: RequestCache;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken, correlationId, headers = {}, cache } = options;

  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(multipart ? {} : { 'Content-Type': 'application/json' }),
      // Identifies this as the web client, which is what the school-web-only rule reads.
      'X-Client-Type': 'web',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
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
