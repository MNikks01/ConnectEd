/**
 * Connections and the requests either side is waiting on (FR-SOC-011).
 */
import { PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ConnectionList } from '@/components/connection-list';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { ConnectionResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Connections · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage() {
  let connections: ConnectionResponse[];

  try {
    connections = (await readAsUser<{ data: ConnectionResponse[] }>('/me/connections')).data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/connections');
    throw error;
  }

  const waitingOnYou = connections.filter((row) => row.status === 'PENDING' && !row.requestedByMe);
  const waitingOnThem = connections.filter((row) => row.status === 'PENDING' && row.requestedByMe);
  const accepted = connections.filter((row) => row.status === 'ACCEPTED');

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href="/social">← Social</Link>
      </p>

      <PageHeader title="Connections" />

      <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
        {/* First, because it is the only section with something for the reader to do. */}
        <section>
          <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>Waiting on you</h2>
          <ConnectionList connections={waitingOnYou} emptyMessage="No requests to answer." />
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>Waiting on them</h2>
          <ConnectionList connections={waitingOnThem} emptyMessage="You have no requests open." />
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>Connected</h2>
          <ConnectionList
            connections={accepted}
            emptyMessage="Nobody yet. Find someone from a post or a class and ask to connect."
          />
        </section>
      </div>
    </main>
  );
}
