/**
 * POST /api/auth/login/2fa — the second leg of a login (FR-AUTH-012).
 *
 * The challenge came back to the browser from the first leg and is handed straight back. It is a
 * bearer for exactly one more request: five minutes, single-use, and spent whether or not the code
 * is right. Keeping it server-side would mean inventing a session store for the gap between a
 * password and a code, which is a lot of machinery to protect something already this short-lived.
 */
import { twoFactorLoginSchema } from '@connected/types';
import { NextResponse, type NextRequest } from 'next/server';

import { callAuthEndpoint, respondWithApiError, respondWithSession } from '@/lib/bff';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = twoFactorLoginSchema.safeParse(await request.json().catch(() => undefined));

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Enter the code from your authenticator.',
          status: 422,
          correlationId: '',
        },
      },
      { status: 422 },
    );
  }

  try {
    return respondWithSession(
      await callAuthEndpoint(
        '/auth/login/2fa',
        parsed.data,
        request.headers.get('x-correlation-id') ?? undefined,
      ),
    );
  } catch (error) {
    return respondWithApiError(error);
  }
}
