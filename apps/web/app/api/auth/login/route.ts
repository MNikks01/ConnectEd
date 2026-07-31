/**
 * POST /api/auth/login — browser-facing login.
 *
 * Validates with the *same* zod schema the API uses, so an obviously bad request never leaves this
 * process. That is a convenience, not a security boundary: the API validates again regardless.
 */
import { loginSchema } from '@connected/types';
import { NextResponse, type NextRequest } from 'next/server';

import { callAuthEndpoint, respondWithApiError, respondWithSession } from '@/lib/bff';

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
    const tokens = await callAuthEndpoint(
      '/auth/login',
      parsed.data,
      request.headers.get('x-correlation-id') ?? undefined,
    );

    return respondWithSession(tokens);
  } catch (error) {
    return respondWithApiError(error);
  }
}
