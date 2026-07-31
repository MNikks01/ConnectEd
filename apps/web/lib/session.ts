/**
 * Session cookies, owned by the Next server.
 *
 * **Why a BFF instead of talking to the API directly from the browser.** The API sets its refresh
 * cookie for its own origin (`localhost:4000`) and path. A browser on `localhost:3000` will not
 * send that cookie back cross-origin without `SameSite=None; Secure`, which cannot work over plain
 * http locally and would weaken CSRF posture in production. So the browser talks only to Next,
 * and Next re-issues the session on its own origin. `.docs/Architecture/03-frontend-architecture.md`
 * anticipates this with "route handlers (BFF proxy where needed)".
 *
 * **Why both tokens are httpOnly cookies.** The architecture doc says "in-memory access token",
 * which suits a purely client-rendered app. It does not work for Server Components, which have no
 * access to browser memory and must be able to call the API during SSR. An httpOnly cookie is also
 * strictly less exposed than a JS variable: script cannot read it, so an XSS bug cannot exfiltrate
 * the token. Deviation recorded in the S0-8 PR.
 */
import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'connected_access';
export const REFRESH_COOKIE = 'connected_refresh';

/** Refresh lives at the site root because middleware and route handlers both need to see it. */
const BASE_COOKIE = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
} as const;

export interface SessionTokens {
  accessToken: string;
  /** Seconds until the access token expires, as reported by the API. */
  expiresIn: number;
  refreshToken: string;
}

export async function readAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function readRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

/**
 * Writes both cookies. The access cookie expires slightly before the token itself, so a request
 * never sets off with a token that will be rejected on arrival.
 */
export function sessionCookies(tokens: SessionTokens): {
  name: string;
  value: string;
  options: Record<string, unknown>;
}[] {
  const accessMaxAge = Math.max(tokens.expiresIn - 30, 30);

  return [
    {
      name: ACCESS_COOKIE,
      value: tokens.accessToken,
      options: { ...BASE_COOKIE, maxAge: accessMaxAge },
    },
    {
      name: REFRESH_COOKIE,
      value: tokens.refreshToken,
      // No maxAge: a session cookie is cleared when the browser closes, and the server-side
      // expiry in `refresh_token.expires_at` remains the real limit either way.
      options: { ...BASE_COOKIE },
    },
  ];
}

export function clearedSessionCookies(): { name: string; options: Record<string, unknown> }[] {
  return [
    { name: ACCESS_COOKIE, options: { ...BASE_COOKIE, maxAge: 0 } },
    { name: REFRESH_COOKIE, options: { ...BASE_COOKIE, maxAge: 0 } },
  ];
}
