/**
 * The moderation queue (S6-6).
 *
 * Oldest first, because a queue is worked from the front. The default filter is `OPEN` — a
 * reviewer opening this page wants the work, not the archive — and the counts are not shown
 * anywhere: a number beside "Open" invites clearing the queue as a score, and the point is to read
 * each one.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { readAsUser, SessionExpiredError } from '@/lib/server-api';
import type { MessageKey } from '@/lib/i18n/translate';
import { getTranslations } from '@/lib/i18n/server';

import type { QueuedReportResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('moderation.metaTitle') };
}
export const dynamic = 'force-dynamic';

const FILTERS: { status: string; label: MessageKey }[] = [
  { status: 'OPEN', label: 'moderation.statusOPEN' },
  { status: 'REVIEWED', label: 'moderation.statusREVIEWED' },
  { status: 'ACTIONED', label: 'moderation.statusACTIONED' },
  { status: 'DISMISSED', label: 'moderation.statusDISMISSED' },
];

const SUBJECT_LABELS: Record<string, MessageKey> = {
  POST: 'moderation.subjectPOST',
  COMMENT: 'moderation.subjectCOMMENT',
  MESSAGE: 'moderation.subjectMESSAGE',
  ACCOUNT: 'moderation.subjectACCOUNT',
};

export default async function ReportQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { t } = await getTranslations();

  const { status: requested } = await searchParams;
  const status = FILTERS.some((filter) => filter.status === requested) ? requested : 'OPEN';

  let reports: QueuedReportResponse[];
  try {
    const response = await readAsUser<{ data: QueuedReportResponse[] }>(
      `/admin/reports?status=${String(status)}`,
    );
    reports = response.data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/admin/reports');
    throw error;
  }

  return (
    <>
      <PageHeader title={t('moderation.title')} description={t('moderation.description')} />

      <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
        <nav
          aria-label={t('moderation.statusNav')}
          style={{ display: 'flex', gap: 'var(--ui-space-3)', flexWrap: 'wrap' }}
        >
          {FILTERS.map((filter) => (
            <Link
              key={filter.status}
              href={`/admin/reports?status=${filter.status}`}
              aria-current={filter.status === status ? 'page' : undefined}
            >
              {t(filter.label)}
            </Link>
          ))}
        </nav>

        {reports.length === 0 ? (
          <Card as="section">
            <p style={{ margin: 0 }}>{t('moderation.empty')}</p>
          </Card>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-4)' }}>
            {reports.map((report) => (
              <li key={report.id}>
                <Card as="article">
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--ui-space-2)',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>
                      {report.subject.type in SUBJECT_LABELS
                        ? t(SUBJECT_LABELS[report.subject.type] as MessageKey)
                        : report.subject.type}
                    </strong>
                    {report.subject.removed ? (
                      <Badge tone="info">{t('moderation.alreadyRemoved')}</Badge>
                    ) : null}
                    {report.reportCount > 1 ? (
                      // Two people objecting is a different signal from one, and it is the only
                      // number on this page — because it changes how a reviewer reads the report.
                      <Badge tone="warning">
                        {t('moderation.reportedByMany', { count: report.reportCount })}
                      </Badge>
                    ) : null}
                  </div>

                  <p style={{ margin: 'var(--ui-space-2) 0' }}>{report.reason}</p>

                  {report.subject.excerpt ? (
                    <blockquote
                      style={{
                        margin: '0 0 var(--ui-space-2)',
                        paddingLeft: 'var(--ui-space-3)',
                        borderLeft: '3px solid var(--ui-color-border, #d1d5db)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {report.subject.excerpt}
                    </blockquote>
                  ) : (
                    <p className="muted" style={{ margin: '0 0 var(--ui-space-2)' }}>
                      {/* Said rather than left blank: a reviewer needs to know the content is
                          withheld by design, not missing by accident. */}
                      {report.subject.type === 'MESSAGE'
                        ? t('moderation.messageWithheldShort')
                        : t('moderation.noContent')}
                    </p>
                  )}

                  <Link href={`/admin/reports/${report.id}`}>{t('moderation.reviewThis')}</Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
