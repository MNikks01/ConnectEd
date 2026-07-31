/**
 * Route guard for authenticated pages.
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

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  if (hasSession) return NextResponse.next();

  const login = new URL('/login', request.nextUrl.origin);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip Next internals, the route handlers (which manage their own auth), and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
