/**
 * The figures on the analytics page (S6-8).
 *
 * Server-rendered: nothing here is interactive, and a chart library would be several hundred
 * kilobytes to draw numbers a table states more precisely. The bars are `aria-hidden` for the same
 * reason they are on the billing page — "Students, 24" already carries everything the bar conveys.
 */
import { Card } from '@connected/ui';

import type { SchoolAnalyticsResponse } from '@connected/types';

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Students',
  PARENT: 'Parents',
  TEACHER: 'Teachers',
  PRINCIPAL: 'Principals',
  USER: 'General users',
};

const ITEM_LABELS: Record<string, string> = {
  HOMEWORK: 'Homework',
  ASSIGNMENT: 'Assignments',
  PROJECT: 'Projects',
};

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  OPEN: 'Open',
  IN_REVIEW: 'In review',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

function label(map: Record<string, string>, key: string): string {
  // An unmapped key prints as itself rather than vanishing: a new enum value should look odd on
  // the page, not be silently absent from a total.
  return map[key] ?? key;
}

function Figures({ title, entries }: { title: string; entries: [string, number][] }) {
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  return (
    <Card as="section">
      <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>{title}</h2>

      {entries.length === 0 ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          Nothing in this period.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
          {entries.map(([key, count]) => (
            <li key={key}>
              <p style={{ margin: '0 0 0.25rem' }}>
                {key}, {count}
              </p>
              <div
                aria-hidden="true"
                style={{
                  height: '0.375rem',
                  borderRadius: 'var(--ui-radius)',
                  background: 'var(--ui-color-surface-2, #e5e7eb)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${String(total === 0 ? 0 : Math.round((count / total) * 100))}%`,
                    height: '100%',
                    background: 'var(--ui-color-accent, #2563eb)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function percent(rate: number | null): string {
  // `null` is "nothing was published", which is not 0% — the API is careful about this and the
  // page would throw the distinction away by formatting it as a number.
  return rate === null ? 'nothing published yet' : `${String(Math.round(rate * 100))}%`;
}

export function AnalyticsPanels({ analytics }: { analytics: SchoolAnalyticsResponse }) {
  const toEntries = (record: Record<string, number>, labels: Record<string, string>) =>
    Object.entries(record)
      .map(([key, count]): [string, number] => [label(labels, key), count])
      .sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Your school</h2>
        <p style={{ marginBottom: 0 }}>
          {analytics.membership.total} verified{' '}
          {analytics.membership.total === 1 ? 'member' : 'members'} across{' '}
          {analytics.structure.classes} {analytics.structure.classes === 1 ? 'class' : 'classes'}{' '}
          and {analytics.structure.subjects}{' '}
          {analytics.structure.subjects === 1 ? 'subject' : 'subjects'}.
        </p>
      </Card>

      <Figures title="Members" entries={toEntries(analytics.membership.byRole, ROLE_LABELS)} />

      <Figures
        title="Published"
        entries={(
          [
            ...toEntries(analytics.publishing.academicItems, ITEM_LABELS),
            ['Notices', analytics.publishing.notices],
            ['Events', analytics.publishing.events],
          ] as [string, number][]
        ).filter(([, count]) => count > 0)}
      />

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Read through</h2>
        <p style={{ margin: '0 0 0.5rem' }}>
          Notices: {percent(analytics.engagement.noticeReadRate)}
        </p>
        <p style={{ margin: '0 0 0.5rem' }}>
          Homework and assignments: {percent(analytics.engagement.academicReadRate)}
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          {/* The denominator, stated. A rate whose base is invisible cannot be argued with. */}
          Measured against your {analytics.engagement.verifiedMembers} verified members.
        </p>
      </Card>

      <Figures
        title="Leave"
        entries={toEntries(analytics.workflows.leaveByStatus, STATUS_LABELS)}
      />

      <Figures
        title="Complaints and suggestions"
        entries={toEntries(analytics.workflows.feedbackByStatus, STATUS_LABELS)}
      />
    </div>
  );
}
