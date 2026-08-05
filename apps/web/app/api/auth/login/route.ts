/**
 * POST /api/auth/login — browser-facing login.
 *
 * Validates with the *same* zod schema the API uses, so an obviously bad request never leaves this
 * process. That is a convenience, not a security boundary: the API validates again regardless.
 */
import { loginSchema } from '@connected/types';
import { NextResponse, type NextRequest } from 'next/server';

import {
  callAuthEndpointAllowingChallenge,
  respondWithApiError,
  respondWithSession,
} from '@/lib/bff';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = loginSchema.safeParse(await request.json().catch(() => undefined));

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Check the details you entered.',
          status: 422,
          correlationId: '',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.') || '(root)',
            issue: issue.message,
          })),
        },
      },
      { status: 422 },
    );
  }

  try {
    const result = await callAuthEndpointAllowingChallenge(
      '/auth/login',
      parsed.data,
      request.headers.get('x-correlation-id') ?? undefined,
    );

    if ('twoFactorRequired' in result) {
      // Passed to the browser rather than kept in a server-side session: it is a bearer for one
      // more request, five minutes long and single-use, and holding it here would mean inventing
      // a session store for the gap between a password and a code.
      return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    return respondWithSession(result);
  } catch (error) {
    return respondWithApiError(error);
  }
}
