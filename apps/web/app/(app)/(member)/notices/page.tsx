/**
 * School notices as a member sees them (FR-ACAD-010).
 *
 * A member can belong to more than one school — a parent with children at two — so the page is
 * keyed by school rather than assuming there is one.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { formatShortDate } from '@/lib/i18n/format';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { MyMembershipResponse, NoticeResponse, Paginated } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('notices.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string; after?: string }>;
}) {
  const { school, after } = await searchParams;
  const { t, locale } = await getTranslations();

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
        <PageHeader title={t('notices.title')} />
        <Card>
          <p style={{ margin: 0 }}>{t('notices.noSchools')}</p>
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
      <PageHeader title={t('notices.title')} description={t('notices.description')} />

      {schools.length > 1 ? (
        <nav aria-label={t('notices.schoolNav')} style={{ marginBottom: 'var(--ui-space-4)' }}>
          <ul className="filter-tabs">
            {schools.map(([id, name]) => (
              <li key={id}>
                <Link
                  href={`/notices?school=${id}`}
                  aria-current={id === schoolId ? 'page' : undefined}
                >
                  {name ?? t('notices.schoolFallback')}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {notices.data.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{t('notices.empty')}</p>
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
                  {notice.read ? null : <Badge tone="info">{t('notices.unread')}</Badge>}
                  <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                    {formatShortDate(notice.createdAt, locale)} ·{' '}
                    {notice.authorName ?? t('notices.schoolFallback')}
                  </span>
                  {notice.readCount === undefined ? null : (
                    <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                      {t('notices.readBy', { count: notice.readCount })}
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
            {t('notices.older')}
          </Link>
        </p>
      ) : null}
    </main>
  );
}
