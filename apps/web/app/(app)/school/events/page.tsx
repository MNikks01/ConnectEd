/**
 * The school calendar, from the school's side (FR-ACAD-011).
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { EventComposer, EventList } from '@/components/event-admin';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';
import { getTranslations } from '@/lib/i18n/server';

import type { CurrentAccountResponse, EventResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('schoolEvents.metaTitle') };
}
export const dynamic = 'force-dynamic';

export default async function SchoolEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ includePast?: string }>;
}) {
  const { t } = await getTranslations();

  const { includePast } = await searchParams;
  const past = includePast === 'true';

  let account: CurrentAccountResponse;
  let events: { data: EventResponse[] };

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');

    // The layout redirects an individual away, but Next renders layout and page in parallel — so
    // without this the page still fires a request the API is certain to refuse, and logs a 403
    // that describes the framework rather than anything the user did.
    if (account.accountType !== 'SCHOOL') redirect('/home');

    events = await readAsUser<{ data: EventResponse[] }>(
      `/schools/${account.id}/events${past ? '?includePast=true' : ''}`,
    );
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/school/events');
    throw error;
  }

  return (
    <>
      <PageHeader title={t('schoolEvents.title')} description={t('schoolEvents.description')} />

      <nav aria-label={t('schoolEvents.rangeNav')} style={{ marginBottom: 'var(--ui-space-4)' }}>
        <ul className="filter-tabs">
          <li>
            <Link href="/school/events" aria-current={past ? undefined : 'page'}>
              {t('schoolEvents.upcoming')}
            </Link>
          </li>
          <li>
            <Link href="/school/events?includePast=true" aria-current={past ? 'page' : undefined}>
              {t('schoolEvents.includingPast')}
            </Link>
          </li>
        </ul>
      </nav>

      <section aria-label={t('schoolEvents.scheduledLabel')}>
        <EventList events={events.data} />
      </section>

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
          {t('schoolEvents.addHeading')}
        </h2>
        <EventComposer schoolId={account.id} />
      </Card>
    </>
  );
}
