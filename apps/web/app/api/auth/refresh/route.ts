/**
 * GET/POST /api/auth/refresh — exchanges the refresh cookie for a fresh access token.
 *
 * Route handlers exist because Server Components cannot set cookies, and refresh *must* persist a
 * new cookie: the API rotates the refresh token on every use, so failing to store the replacement
 * would present the old one next time and trip reuse detection, revoking the whole family.
 *
 * GET supports the redirect flow — a page whose access cookie expired sends the user here with
 * `?next=`, and lands them back where they were.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { callAuthEndpoint, respondWithApiError, respondWithSession } from '@/lib/bff';
import { clearedSessionCookies, REFRESH_COOKIE } from '@/lib/session';

async function rotate(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return { tokens: undefined, error: undefined } as const;
  }

  const tokens = await callAuthEndpoint(
    '/auth/refresh',
    { refreshToken },
    request.headers.get('x-correlation-id') ?? undefined,
  );

  return { tokens, error: undefined } as const;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { tokens } = await rotate(request);

    if (!tokens) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Please sign in.',
            status: 401,
            correlationId: '',
          },
        },
        { status: 401 },
      );
    }

    return respondWithSession(tokens);
  } catch (error) {
    return respondWithApiError(error);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Only same-app paths, so `?next=` cannot be used as an open redirect.
  const requested = request.nextUrl.searchParams.get('next') ?? '/home';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/home';

  try {
    const { tokens } = await rotate(request);

    if (!tokens) {
      return redirectToLogin(request);
    }

    const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
    const { sessionCookies } = await import('@/lib/session');

    for (const cookie of sessionCookies(tokens)) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    return response;
  } catch {
    // A failed refresh means the session is over — clear it rather than looping.
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL('/login?expired=1', request.nextUrl.origin));

  for (const cookie of clearedSessionCookies()) {
    response.cookies.set(cookie.name, '', cookie.options);
  }

  return response;
}
