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

import type { QueuedReportResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reports · GetConnected' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { status: 'OPEN', label: 'Open' },
  { status: 'REVIEWED', label: 'Needs a second look' },
  { status: 'ACTIONED', label: 'Actioned' },
  { status: 'DISMISSED', label: 'Dismissed' },
];

const SUBJECT_LABELS: Record<string, string> = {
  POST: 'a post',
  COMMENT: 'a comment',
  MESSAGE: 'a message',
  ACCOUNT: 'an account',
};

export default async function ReportQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
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
      <PageHeader
        title="Reports"
        description="What people have reported, oldest first. Every decision is recorded against your account."
      />

      <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
        <nav
          aria-label="Status"
          style={{ display: 'flex', gap: 'var(--ui-space-3)', flexWrap: 'wrap' }}
        >
          {FILTERS.map((filter) => (
            <Link
              key={filter.status}
              href={`/admin/reports?status=${filter.status}`}
              aria-current={filter.status === status ? 'page' : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </nav>

        {reports.length === 0 ? (
          <Card as="section">
            <p style={{ margin: 0 }}>Nothing here.</p>
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
                    <strong>{SUBJECT_LABELS[report.subject.type] ?? report.subject.type}</strong>
                    {report.subject.removed ? <Badge tone="info">Already removed</Badge> : null}
                    {report.reportCount > 1 ? (
                      // Two people objecting is a different signal from one, and it is the only
                      // number on this page — because it changes how a reviewer reads the report.
                      <Badge tone="warning">Reported by {report.reportCount} people</Badge>
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
                        ? 'The message itself is not shown — a private conversation is not made public by being reported.'
                        : 'No content to show.'}
                    </p>
                  )}

                  <Link href={`/admin/reports/${report.id}`}>Review this</Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
