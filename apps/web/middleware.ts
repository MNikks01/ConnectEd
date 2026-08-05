/**
 * Response headers, and a route guard for authenticated pages.
 *
 * Two jobs, and only one of them is security. The `Content-Security-Policy` is here because it
 * carries a per-response nonce, and a nonce can only be minted where a response is being made —
 * `next.config.mjs` can only send headers that never change. What each directive is for is
 * explained in `lib/security-headers.ts`.
 *
 * The guard below is the other job:
 *
 * This is a **UX guard, not a security boundary** (`.docs/Architecture/03-frontend-architecture.md`:
 * "role-based route guards mirror the server permission matrix — defense in depth, never the sole
 * gate"). It only checks that a session cookie exists; it does not validate the token, because it
 * cannot — and must not be trusted to. Every piece of data on those pages is fetched from the API,
 * which authorizes each request on its own.
 *
 * Its real job is avoiding a pointless round trip: sending a signed-out visitor straight to the
 * login page instead of rendering a shell that immediately redirects.
 */
import { NextResponse, type NextRequest } from 'next/server';

import {
  apiConnectOrigins,
  contentSecurityPolicy,
  createNonce,
  imageOriginsFromEnv,
} from '@/lib/security-headers';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/session';

const PROTECTED_PREFIXES = [
  '/home',
  '/school',
  '/student',
  '/parent',
  '/teacher',
  '/principal',
  '/social',
];

/**
 * The policy for this response.
 *
 * `CSP_CONNECT_ORIGINS` exists because the socket's address is deployment configuration, and
 * `NEXT_PUBLIC_API_URL` — the only other place it is written down — is inlined when the bundle is
 * built rather than read when the server runs. A build made in CI and deployed against a different
 * API would otherwise refuse the connection. Unset, the build-time value is the best guess
 * available, which is right in every environment that builds where it runs.
 */
function policyFor(nonce: string): string {
  const development = process.env.NODE_ENV !== 'production';
  const configured = (process.env.CSP_CONNECT_ORIGINS ?? '').split(/\s+/).filter(Boolean);

  return contentSecurityPolicy({
    nonce,
    connectOrigins:
      configured.length > 0 ? configured : apiConnectOrigins(process.env.NEXT_PUBLIC_API_URL),
    imageOrigins: imageOriginsFromEnv(process.env.CSP_IMG_ORIGINS, development),
    development,
  });
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const nonce = createNonce();
  const policy = policyFor(nonce);

  // How Next learns the nonce: `app-render` parses a CSP header and stamps the nonce it finds on
  // the script tags it emits. Without it the policy would refuse Next's own bootstrap and nothing
  // on the page would hydrate.
  //
  // Set in both places on purpose. On 16.2 the header below — the one on the response — is what it
  // actually reads; deleting this request copy changes nothing, which was checked rather than
  // assumed. It stays because setting the request header is the shape Next's own documentation
  // prescribes, so a version that reads it there keeps working.
  const headers = new Headers(request.headers);
  headers.set('content-security-policy', policy);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const hasSession = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  const response =
    isProtected && !hasSession
      ? NextResponse.redirect(new URL('/login', request.nextUrl.origin))
      : NextResponse.next({ request: { headers } });

  response.headers.set('content-security-policy', policy);
  return response;
}

export const config = {
  // Skip Next internals, the route handlers (which manage their own auth), and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
