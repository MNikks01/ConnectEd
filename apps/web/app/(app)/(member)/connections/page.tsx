/**
 * Connections and the requests either side is waiting on (FR-SOC-011).
 */
import { PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ConnectionList } from '@/components/connection-list';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { ConnectionResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('connections.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage() {
  const { t } = await getTranslations();

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
        <Link href="/social">{t('connections.backToSocial')}</Link>
      </p>

      <PageHeader title={t('connections.title')} />

      <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
        {/* First, because it is the only section with something for the reader to do. */}
        <section>
          <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{t('connections.waitingOnYou')}</h2>
          <ConnectionList
            connections={waitingOnYou}
            emptyMessage={t('connections.emptyWaitingOnYou')}
          />
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{t('connections.waitingOnThem')}</h2>
          <ConnectionList
            connections={waitingOnThem}
            emptyMessage={t('connections.emptyWaitingOnThem')}
          />
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{t('connections.connected')}</h2>
          <ConnectionList connections={accepted} emptyMessage={t('connections.emptyConnected')} />
        </section>
      </div>
    </main>
  );
}
