'use client';

/**
 * Refreshes the messages pages when something arrives (FR-SOC-022).
 *
 * A component rather than a hook call in each page, because both pages are Server Components and
 * cannot hold an effect. It renders nothing.
 *
 * `router.refresh()` re-runs the Server Component on the server and patches the result in, so the
 * conversation updates without losing what the user has typed into the reply box. Nothing is
 * inserted locally: the server is asked, and the server authorizes.
 */
import { useRouter } from 'next/navigation';

import { useRealtime } from '@/lib/realtime';

export function LiveMessages() {
  const router = useRouter();

  useRealtime(() => {
    router.refresh();
  });

  return null;
}
