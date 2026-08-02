/**
 * School notices as a member sees them (FR-ACAD-010).
 *
 * A member can belong to more than one school — a parent with children at two — so the page is
 * keyed by school rather than assuming there is one.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { MyMembershipResponse, NoticeResponse, Paginated } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Notices · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string; after?: string }>;
}) {
  const { school, after } = await searchParams;

  let memberships: MyMembershipResponse[];
  try {
    memberships = (await readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships')).data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/notices');
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
        <PageHeader title="Notices" />
        <Card>
          <p style={{ margin: 0 }}>
            Notices appear here once a school has verified you as a member.
          </p>
        </Card>
      </main>
    );
  }

  const schoolId = schools.some(([id]) => id === school) ? school : schools[0]?.[0];
  const query = after ? `?cursor=${encodeURIComponent(after)}` : '';
  const notices = await readAsUser<Paginated<NoticeResponse>>(
    `/schools/${schoolId}/notices${query}`,
  );

  return (
    <main>
      <PageHeader title="Notices" description="From your school." />

      {schools.length > 1 ? (
        <nav aria-label="School" style={{ marginBottom: 'var(--ui-space-4)' }}>
          <ul className="filter-tabs">
            {schools.map(([id, name]) => (
              <li key={id}>
                <Link
                  href={`/notices?school=${id}`}
                  aria-current={id === schoolId ? 'page' : undefined}
                >
                  {name ?? 'School'}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {notices.data.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>Nothing has been posted yet.</p>
        </Card>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
          {notices.data.map((notice) => (
            <li key={notice.id}>
              <Card>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--ui-space-2)',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  {notice.read ? null : <Badge tone="info">Unread</Badge>}
                  <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                    {new Date(notice.createdAt).toLocaleDateString('en-GB')} ·{' '}
                    {notice.authorName ?? 'School'}
                  </span>
                  {notice.readCount === undefined ? null : (
                    <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                      Read by {notice.readCount}
                    </span>
                  )}
                </div>

                <h2 style={{ margin: 'var(--ui-space-2) 0 0', fontSize: 'var(--ui-text-base)' }}>
                  <Link href={`/notices/${notice.id}`}>{notice.title}</Link>
                </h2>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {notices.nextCursor ? (
        <p style={{ marginTop: 'var(--ui-space-4)' }}>
          <Link
            href={`/notices?school=${schoolId}&after=${encodeURIComponent(notices.nextCursor)}`}
          >
            Older notices
          </Link>
        </p>
      ) : null}
    </main>
  );
}
