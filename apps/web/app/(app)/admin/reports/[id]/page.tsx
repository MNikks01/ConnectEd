/**
 * One report, and the decision on it (S6-6).
 *
 * Deliberately shows the reported content in full rather than the queue's excerpt. A reviewer
 * removing someone's words should have read all of them.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ReportDecision } from '@/components/report-decision';
import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';
import type { MessageKey } from '@/lib/i18n/translate';
import { getTranslations } from '@/lib/i18n/server';

import type { QueuedReportResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('moderation.detailMetaTitle') };
}
export const dynamic = 'force-dynamic';

const REMOVABLE = new Set(['POST', 'COMMENT']);

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'moderation.statusOPEN',
  REVIEWED: 'moderation.statusREVIEWED',
  ACTIONED: 'moderation.statusACTIONED',
  DISMISSED: 'moderation.statusDISMISSED',
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getTranslations();

  const { id } = await params;

  let report: QueuedReportResponse;
  try {
    report = await readAsUser<QueuedReportResponse>(`/admin/reports/${id}`);
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect(`/api/auth/refresh?next=/admin/reports/${id}`);
    }
    // 404 covers both "no such report" and "you are not staff", and the console must not tell the
    // two apart any more than the API does.
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader title={t('moderation.detailTitle')} description={report.reason} />

      <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
        <p style={{ margin: 0 }}>
          <Link href="/admin/reports">{t('moderation.backToQueue')}</Link>
        </p>

        <Card as="section">
          <div
            style={{
              display: 'flex',
              gap: 'var(--ui-space-2)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 'var(--ui-text-lg)' }}>
              {report.subject.authorDisplayName ?? t('moderation.someone')}
            </h2>
            <Badge tone={report.status === 'OPEN' ? 'warning' : 'info'}>
              {report.status in STATUS_LABELS
                ? t(STATUS_LABELS[report.status] as MessageKey)
                : report.status}
            </Badge>
            {report.subject.removed ? (
              <Badge tone="info">{t('moderation.alreadyRemoved')}</Badge>
            ) : null}
          </div>

          {report.subject.excerpt ? (
            <blockquote
              style={{
                margin: 'var(--ui-space-3) 0 0',
                paddingLeft: 'var(--ui-space-3)',
                borderLeft: '3px solid var(--ui-color-border, #d1d5db)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {report.subject.excerpt}
            </blockquote>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              {report.subject.type === 'MESSAGE'
                ? t('moderation.messageWithheldLong')
                : t('moderation.noContentDetail')}
            </p>
          )}

          <p className="muted" style={{ marginBottom: 0 }}>
            {/* The reporter is not named anywhere, and this says so — otherwise a reviewer looks
                for the name and assumes the page is broken when they cannot find it. */}
            {report.reportCount === 1
              ? t('moderation.reportedOnce')
              : t('moderation.reportedTimes', { count: report.reportCount })}
          </p>
        </Card>

        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>{t('moderation.decide')}</h2>
          <ReportDecision reportId={report.id} removable={REMOVABLE.has(report.subject.type)} />
        </Card>
      </div>
    </>
  );
}
