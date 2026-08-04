/**
 * POST /api/rum — forwards browser measurements to the API.
 *
 * Through the BFF rather than straight to the API for one practical reason: the API's origin is
 * server configuration, and a beacon fired during `visibilitychange` has no time to fetch it
 * first. Same-origin also means no preflight, which a beacon cannot wait for either.
 *
 * Nothing here is authenticated and nothing is stored. A failure is swallowed: a monitoring
 * endpoint that reports its own trouble to the browser teaches the browser to retry, and a retry
 * storm from every visitor is worse than a lost measurement.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { API_URL } from '@/lib/api-client';

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    await fetch(`${API_URL}/rum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // The page may already be unloading; there is nobody left to wait for a response.
      keepalive: true,
    });
  } catch {
    // Swallowed on purpose. See above.
  }

  return new NextResponse(null, { status: 204 });
}
