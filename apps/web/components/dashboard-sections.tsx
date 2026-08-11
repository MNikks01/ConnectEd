/**
 * The pieces a role dashboard is assembled from (S2-11).
 *
 * Server Components, deliberately: every one of these renders data the API already authorized, and
 * none of them needs interactivity. They are separated from the page so a role's dashboard is a
 * short list of sections rather than three hundred lines of conditionals.
 */
import { Badge, Card } from '@connected/ui';
import Link from 'next/link';

import { formatShortDate } from '@/lib/i18n/format';
import { getTranslations } from '@/lib/i18n/server';

import type { Locale } from '@/lib/i18n/locales';
import type { Translator } from '@/lib/i18n/translate';
import type {
  AcademicItemResponse,
  MyTeachingSubjectResponse,
  NoticeResponse,
} from '@connected/types';

/** An item plus the class it came from — the feed endpoint is per class, the dashboard is not. */
export interface DashboardItem extends AcademicItemResponse {
  className: string;
}

function formatDue(dueAt: string, t: Translator, locale: Locale): string {
  const due = new Date(dueAt);
  const days = Math.ceil((due.getTime() - Date.now()) / (24 * 3600_000));

  // "in 3 days" beats a date a parent has to count on their fingers, but only near the deadline.
  //
  // Each branch is a whole phrase in the catalogue rather than a word glued to a number. "due in"
  // + n + "days" is three fragments a translator cannot reorder, and word order is exactly what
  // changes between English and Hindi here.
  if (days <= 0) return t('dashboard.dueToday');
  if (days === 1) return t('dashboard.dueTomorrow');
  if (days <= 7) return t('dashboard.dueInDays', { count: days });

  return t('dashboard.dueOn', { date: formatShortDate(due, locale) });
}

export async function DueSoon({ items }: { items: DashboardItem[] }) {
  const { t, locale } = await getTranslations();

  return (
    <section>
      <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{t('dashboard.dueSoon')}</h2>

      {items.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{t('dashboard.noDeadlines')}</p>
        </Card>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--ui-space-2)',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <Badge tone="warning">{formatDue(item.dueAt ?? '', t, locale)}</Badge>
                  {item.read ? null : <Badge tone="info">{t('dashboard.unread')}</Badge>}
                </div>

                <h3 style={{ margin: 'var(--ui-space-2) 0 0', fontSize: 'var(--ui-text-base)' }}>
                  <Link href={`/academics/${item.id}`}>{item.title}</Link>
                </h3>

                <p
                  className="muted"
                  style={{ margin: '0.25rem 0 0', fontSize: 'var(--ui-text-sm)' }}
                >
                  {item.className} · {item.subjectName ?? t('dashboard.subjectFallback')}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export async function UnreadWork({ items }: { items: DashboardItem[] }) {
  if (items.length === 0) return null;

  const { t } = await getTranslations();

  return (
    <section>
      <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{t('dashboard.notReadYet')}</h2>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-2)' }}>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/academics/${item.id}`}>{item.title}</Link>
            <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
              {' '}
              — {item.className}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What a teacher opens the product to do: reach the class they are about to publish to. */
export async function TeachingSubjects({ subjects }: { subjects: MyTeachingSubjectResponse[] }) {
  const { t } = await getTranslations();

  return (
    <section>
      <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{t('dashboard.whatYouTeach')}</h2>

      {/* Defensive: a teacher request must name at least one subject (FR-VER-003), so a verified
          teacher normally has an allocation. This renders if one is later removed — a deleted
          subject cascades its allocations away — rather than showing an empty heading. */}
      {subjects.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{t('dashboard.noAllocation')}</p>
        </Card>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
          {subjects.map((subject) => (
            <li key={subject.subjectId}>
              <Card>
                <h3 style={{ margin: 0, fontSize: 'var(--ui-text-base)' }}>
                  <Link href={`/classes/${subject.classId}`}>
                    {subject.subjectName} · {subject.className}
                  </Link>
                </h3>

                <p
                  className="muted"
                  style={{ margin: '0.25rem 0 0', fontSize: 'var(--ui-text-sm)' }}
                >
                  {subject.schoolName ?? t('dashboard.schoolFallback')} ·{' '}
                  <Link href={`/classes/${subject.classId}/syllabus`}>
                    {t('dashboard.syllabusCoverage')}
                  </Link>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export async function RecentNotices({ notices }: { notices: NoticeResponse[] }) {
  if (notices.length === 0) return null;

  const { t } = await getTranslations();

  return (
    <section>
      <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{t('dashboard.fromYourSchool')}</h2>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-2)' }}>
        {notices.map((notice) => (
          <li key={notice.id}>
            {notice.read ? null : (
              <>
                <Badge tone="info">{t('dashboard.unread')}</Badge>{' '}
              </>
            )}
            <Link href={`/notices/${notice.id}`}>{notice.title}</Link>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 'var(--ui-space-3)' }}>
        <Link href="/notices">{t('dashboard.allNotices')}</Link>
      </p>
    </section>
  );
}
