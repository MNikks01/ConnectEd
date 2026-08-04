/**
 * The browser half of live delivery (FR-SOC-022, ADR-0016).
 *
 * Deliberately small. It refreshes the current route when the server says a thread moved, and
 * does nothing else: no local cache, no optimistic insert, no parsing of what arrived. The Server
 * Component re-reads through the API, which authorizes the read — so a socket opened before
 * someone was blocked cannot show them anything after.
 *
 * **Everything here is best-effort.** No ticket, no socket, a dropped connection: the product
 * behaves exactly as it did before websockets, which is to say it updates when you navigate.
 */
'use client';

import { useEffect, useRef } from 'react';

/** Grows on each failure and resets on a successful open. */
const BACKOFF_MS = [1000, 2000, 5000, 15000, 30000];

export function useRealtime(onEvent: () => void): void {
  // Held in a ref so a re-render with a new callback does not tear down the socket — reconnecting
  // on every render would spend a ticket per render and hit the endpoint's rate limit.
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let cancelled = false;

    async function connect(): Promise<void> {
      if (cancelled) return;

      // The URL comes back with the ticket rather than being built here: the API's address is
      // server configuration, and a `NEXT_PUBLIC_` variable would freeze it into the bundle at
      // build time.
      let url: string;
      try {
        const response = await fetch('/api/realtime/ticket', { method: 'POST' });
        if (!response.ok) throw new Error(String(response.status));
        url = ((await response.json()) as { url: string }).url;
      } catch {
        retry();
        return;
      }

      if (cancelled) return;

      socket = new WebSocket(url);

      socket.onopen = () => {
        attempt = 0;
      };

      socket.onmessage = () => {
        // What arrived is not read. The only fact used is that something changed; the page asks
        // the server what it is, and the server decides what this person may see.
        handler.current();
      };

      // A closed socket and a failed one are the same situation from here, and `onerror` is
      // followed by `onclose` anyway — reconnecting from both would double every attempt.
      socket.onclose = () => {
        if (!cancelled) retry();
      };
    }

    function retry(): void {
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 30000;
      attempt += 1;
      timer = setTimeout(() => void connect(), delay);
    }

    void connect();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      // `onclose` is cleared first: otherwise unmounting schedules a reconnect for a page that is
      // no longer on screen, and navigating around the app accumulates them.
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);
}
