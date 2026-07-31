/**
 * POST /api/auth/logout — revokes the session server-side, then clears the local cookies.
 *
 * The API call comes first and its failure is swallowed: if the server cannot be reached, the user
 * still gets logged out of this browser. Leaving them apparently signed in because a network call
 * failed would be worse than a stale server-side row, which expires on its own.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { apiFetch } from '@/lib/api-client';
import { respondWithClearedSession } from '@/lib/bff';
import { REFRESH_COOKIE } from '@/lib/session';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: { refreshToken },
        correlationId: request.headers.get('x-correlation-id') ?? undefined,
      });
    } catch {
      // Deliberately ignored — see the note above.
    }
  }

  return respondWithClearedSession();
}
