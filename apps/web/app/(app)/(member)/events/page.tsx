/**
 * The school calendar (FR-ACAD-011). Upcoming by default — past events are history.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { formatDateTime } from '@/lib/i18n/format';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { EventResponse, MyMembershipResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('events.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string; includePast?: string }>;
}) {
  const { school, includePast } = await searchParams;
  const { t, locale } = await getTranslations();

  let memberships: MyMembershipResponse[];
  try {
    memberships = (await readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships')).data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/events');
    throw error;
  }

  const schools = [
    ...new Map(
      memberships.map((membership) => [membership.schoolId, membership.schoolName]),
    ).entries(),
  ];

  if (schools.length === 0) {
    return (
      <main>
        <PageHeader title={t('events.title')} />
        <Card>
          <p style={{ margin: 0 }}>{t('events.noSchools')}</p>
        </Card>
      </main>
    );
  }

  const schoolId = schools.some(([id]) => id === school) ? school : schools[0]?.[0];
  const past = includePast === 'true';
  const events = await readAsUser<{ data: EventResponse[] }>(
    `/schools/${schoolId}/events${past ? '?includePast=true' : ''}`,
  );

  return (
    <main>
      <PageHeader
        title={t('events.title')}
        description={past ? t('events.allDescription') : t('events.upcomingDescription')}
      />

      <nav aria-label={t('events.rangeNav')} style={{ marginBottom: 'var(--ui-space-4)' }}>
        <ul className="filter-tabs">
          <li>
            <Link href={`/events?school=${schoolId}`} aria-current={past ? undefined : 'page'}>
              {t('events.upcoming')}
            </Link>
          </li>
          <li>
            <Link
              href={`/events?school=${schoolId}&includePast=true`}
              aria-current={past ? 'page' : undefined}
            >
              {t('events.includingPast')}
            </Link>
          </li>
        </ul>
      </nav>

      {events.data.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{past ? t('events.emptyPast') : t('events.emptyUpcoming')}</p>
        </Card>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
          {events.data.map((event) => (
            <li key={event.id}>
              <Card>
                <p className="muted" style={{ margin: 0, fontSize: 'var(--ui-text-sm)' }}>
                  {/* Weekday included: "Friday 14th" is how a parent thinks about a school event. */}
                  {formatDateTime(event.eventAt, locale)}
                </p>

                <h2 style={{ margin: '0.25rem 0 0.5rem', fontSize: 'var(--ui-text-base)' }}>
                  {event.title}
                </h2>

                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{event.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
