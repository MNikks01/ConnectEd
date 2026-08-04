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

import type { QueuedReportResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Report · GetConnected' };
export const dynamic = 'force-dynamic';

const REMOVABLE = new Set(['POST', 'COMMENT']);

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  REVIEWED: 'Needs a second look',
  ACTIONED: 'Actioned',
  DISMISSED: 'Dismissed',
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
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
      <PageHeader title="Report" description={report.reason} />

      <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
        <p style={{ margin: 0 }}>
          <Link href="/admin/reports">Back to the queue</Link>
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
              {report.subject.authorDisplayName ?? 'Someone'}
            </h2>
            <Badge tone={report.status === 'OPEN' ? 'warning' : 'info'}>
              {STATUS_LABELS[report.status] ?? report.status}
            </Badge>
            {report.subject.removed ? <Badge tone="info">Already removed</Badge> : null}
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
                ? 'The message itself is not shown — a private conversation is not made public by being reported. You have the sender and the reporter’s description.'
                : 'There is no content to show for this kind of report.'}
            </p>
          )}

          <p className="muted" style={{ marginBottom: 0 }}>
            {/* The reporter is not named anywhere, and this says so — otherwise a reviewer looks
                for the name and assumes the page is broken when they cannot find it. */}
            Reported {report.reportCount === 1 ? 'once' : `by ${String(report.reportCount)} people`}
            . Reporters are never named.
          </p>
        </Card>

        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Decide</h2>
          <ReportDecision reportId={report.id} removable={REMOVABLE.has(report.subject.type)} />
        </Card>
      </div>
    </>
  );
}
