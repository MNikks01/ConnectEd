/**
 * POST /api/auth/register — browser-facing individual registration.
 *
 * School registration is deliberately absent: it is a web-only flow with a different shape and
 * lands with the school portal, not the auth skeleton.
 */
import { registerIndividualSchema } from '@connected/types';
import { NextResponse, type NextRequest } from 'next/server';

import { callAuthEndpoint, respondWithApiError, respondWithSession } from '@/lib/bff';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = registerIndividualSchema.safeParse(await request.json().catch(() => undefined));

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
      '/auth/register',
      parsed.data,
      request.headers.get('x-correlation-id') ?? undefined,
    );

    return respondWithSession(tokens, 201);
  } catch (error) {
    return respondWithApiError(error);
  }
}
