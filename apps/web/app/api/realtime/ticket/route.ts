/**
 * POST /api/realtime/ticket — mints a WebSocket credential for the browser.
 *
 * The browser holds no API credential: the access token lives in an httpOnly cookie on *this*
 * origin and never leaves the server. So the one thing the browser must present to the API — a
 * ticket — has to be fetched through here.
 *
 * `callAsUser` rather than a bare fetch, so an expired access token is refreshed and the
 * connection succeeds rather than dropping the user to the sign-in page because a socket
 * reconnected at the wrong moment.
 */
import { NextResponse } from 'next/server';

import { API_URL } from '@/lib/api-client';
import { callAsUser, SessionExpiredError } from '@/lib/server-api';

/**
 * Where the socket lives, derived from the API base this process is already configured with.
 *
 * Sent from here rather than read from a `NEXT_PUBLIC_` variable in the browser, because those are
 * inlined at **build** time: a build made without one would ship a bundle that can never connect,
 * however the environment is configured afterwards. This is the same value the server uses for
 * every other call, resolved at request time.
 */
function socketUrl(ticket: string): string {
  const url = new URL(API_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  // The REST prefix is not the socket path; `/ws` sits at the root of the same origin.
  url.pathname = '/ws';
  url.search = `?ticket=${encodeURIComponent(ticket)}`;
  return url.toString();
}

export async function POST() {
  try {
    const ticket = await callAsUser<{ ticket: string; expiresInSeconds: number }>(
      '/me/realtime-ticket',
      { method: 'POST' },
    );

    // `no-store` matters more here than on an ordinary read: a cached ticket is a credential
    // served to whoever asks next.
    return NextResponse.json(
      { url: socketUrl(ticket.ticket), expiresInSeconds: ticket.expiresInSeconds },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return NextResponse.json({ error: 'session expired' }, { status: 401 });
    }

    // Live updates are an optimisation. A failure here is reported plainly and the caller falls
    // back to reading on navigation, which is what the product did before this existed.
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
