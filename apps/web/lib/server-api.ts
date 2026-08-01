/**
 * Server-side API access for the portal.
 *
 * Two entry points, because Next draws a hard line here:
 *
 * - `readAsUser` is for **Server Components**. They cannot set cookies, so when the access token
 *   has lapsed they cannot refresh — they throw a marker the page turns into a redirect through
 *   the refresh route handler.
 * - `callAsUser` is for **Server Actions**, which *can* set cookies. It refreshes and retries once
 *   on an auth failure, so a mutation submitted just after the access token expired succeeds
 *   instead of dumping the user back at the login screen with their form contents gone.
 *
 * The refresh half matters more than it looks: the API rotates the refresh token on every use, so
 * a retry that forgot to persist the replacement would present a spent token next time and trip
 * reuse detection — logging the user out of every session.
 */
import { cookies } from 'next/headers';

import { ApiError, apiFetch, type ApiRequestOptions } from './api-client';
import { REFRESH_COOKIE, sessionCookies, readAccessToken } from './session';

import type { SessionResponse } from '@connected/types';

/** Thrown when a Server Component has no usable session; pages turn this into a redirect. */
export class SessionExpiredError extends Error {
  constructor() {
    super('The session has expired.');
    this.name = 'SessionExpiredError';
  }
}

/** Read path for Server Components. Never attempts a refresh — it could not persist the result. */
export async function readAsUser<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const accessToken = await readAccessToken();
  if (!accessToken) throw new SessionExpiredError();

  try {
    return await apiFetch<T>(path, { ...options, accessToken });
  } catch (error) {
    if (error instanceof ApiError && error.isAuthFailure) {
      throw new SessionExpiredError();
    }
    throw error;
  }
}

/**
 * Mutation path for Server Actions. Refreshes and retries once on an auth failure.
 */
export async function callAsUser<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const jar = await cookies();
  const accessToken = jar.get('connected_access')?.value;

  if (accessToken) {
    try {
      return await apiFetch<T>(path, { ...options, accessToken });
    } catch (error) {
      if (!(error instanceof ApiError) || !error.isAuthFailure) throw error;
      // Fall through to refresh.
    }
  }

  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) throw new SessionExpiredError();

  let session: SessionResponse & { refreshToken?: string };
  try {
    // Asking as a mobile client returns the new refresh token in the body, which is the only way
    // a Server Action can read it — it cannot see the API's Set-Cookie header.
    session = await apiFetch<SessionResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      headers: { 'X-Client-Type': 'mobile' },
    });
  } catch {
    throw new SessionExpiredError();
  }

  if (!session.refreshToken) throw new SessionExpiredError();

  for (const cookie of sessionCookies({
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    refreshToken: session.refreshToken,
  })) {
    jar.set(cookie.name, cookie.value, cookie.options);
  }

  return apiFetch<T>(path, { ...options, accessToken: session.accessToken });
}

/** Narrows an unknown error to the API's machine-readable code, for action result mapping. */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}

export function apiFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.details) return {};
  return Object.fromEntries(error.details.map((detail) => [detail.field, detail.issue]));
}
