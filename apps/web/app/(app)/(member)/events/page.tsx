/**
 * The school calendar (FR-ACAD-011). Upcoming by default — past events are history.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { EventResponse, MyMembershipResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Events · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string; includePast?: string }>;
}) {
  const { school, includePast } = await searchParams;

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
        <PageHeader title="Events" />
        <Card>
          <p style={{ margin: 0 }}>Events appear here once a school has verified you.</p>
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
        title="Events"
        description={past ? 'Everything, including past.' : 'What is coming up.'}
      />

      <nav aria-label="Range" style={{ marginBottom: 'var(--ui-space-4)' }}>
        <ul className="filter-tabs">
          <li>
            <Link href={`/events?school=${schoolId}`} aria-current={past ? undefined : 'page'}>
              Upcoming
            </Link>
          </li>
          <li>
            <Link
              href={`/events?school=${schoolId}&includePast=true`}
              aria-current={past ? 'page' : undefined}
            >
              Including past
            </Link>
          </li>
        </ul>
      </nav>

      {events.data.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            {past ? 'No events yet.' : 'Nothing coming up. Check back later.'}
          </p>
        </Card>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
          {events.data.map((event) => (
            <li key={event.id}>
              <Card>
                <p className="muted" style={{ margin: 0, fontSize: 'var(--ui-text-sm)' }}>
                  {/* Weekday included: "Friday 14th" is how a parent thinks about a school event. */}
                  {new Date(event.eventAt).toLocaleString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
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
