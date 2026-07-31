/**
 * Shared plumbing for the auth route handlers.
 *
 * The API returns the refresh token as a `Set-Cookie` for *its* origin. This app cannot use that
 * cookie directly (different origin and path), so it reads the value out and re-issues it as its
 * own cookie. The token itself is opaque to both sides — only the server-side row gives it meaning.
 */
import { NextResponse } from 'next/server';

import { API_URL, ApiError } from './api-client';
import { clearedSessionCookies, sessionCookies, type SessionTokens } from './session';

import { ErrorCode, type ErrorEnvelope, type SessionResponse } from '@connected/types';

/** The API's refresh cookie name — see `apps/api/src/modules/auth/auth.controller.ts`. */
const API_REFRESH_COOKIE = 'connected_refresh';

/**
 * Calls an auth endpoint and returns both the session body and the refresh token lifted out of
 * the API's Set-Cookie header.
 */
export async function callAuthEndpoint(
  path: string,
  body: unknown,
  correlationId?: string,
): Promise<SessionTokens> {
  const response = await fetchWithCookies(path, body, correlationId);
  const refreshToken = readSetCookie(response.headers, API_REFRESH_COOKIE);

  if (!refreshToken) {
    // The API always issues one for a web client; its absence means the contract changed.
    throw new Error('The API did not return a refresh token.');
  }

  return {
    accessToken: response.body.accessToken,
    expiresIn: response.body.expiresIn,
    refreshToken,
  };
}

/**
 * `apiFetch` discards headers, and this is the one place that needs them, so the call is made
 * directly here rather than widening the shared client for a single caller.
 */
async function fetchWithCookies(
  path: string,
  body: unknown,
  correlationId?: string,
): Promise<{ body: SessionResponse; headers: Headers }> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'web',
      ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

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

  return { body: payload as SessionResponse, headers: response.headers };
}

/** Minimal Set-Cookie parse: we need one known name, not a general cookie jar. */
function readSetCookie(headers: Headers, name: string): string | undefined {
  const raw = headers.getSetCookie?.() ?? [];

  for (const cookie of raw) {
    const [pair] = cookie.split(';');
    const [key, ...rest] = (pair ?? '').split('=');
    if (key?.trim() === name) {
      const value = rest.join('=').trim();
      if (value.length > 0) return value;
    }
  }

  return undefined;
}

/** Attaches session cookies to a JSON response. */
export function respondWithSession(tokens: SessionTokens, status = 200): NextResponse {
  const response = NextResponse.json({ ok: true }, { status });

  for (const cookie of sessionCookies(tokens)) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  return response;
}

export function respondWithClearedSession(status = 204): NextResponse {
  const response = new NextResponse(null, { status });

  for (const cookie of clearedSessionCookies()) {
    response.cookies.set(cookie.name, '', cookie.options);
  }

  return response;
}

/** Maps an ApiError onto the same envelope shape the browser already understands. */
export function respondWithApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          status: error.status,
          correlationId: error.correlationId ?? '',
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL',
        message: 'Something went wrong. Please try again.',
        status: 500,
        correlationId: '',
      },
    },
    { status: 500 },
  );
}
