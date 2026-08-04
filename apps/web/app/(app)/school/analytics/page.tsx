/**
 * School analytics (S6-8, FR-BILL-003).
 *
 * The interesting state is the one where the school **cannot** see this. A plan that does not
 * include analytics answers 402, and the page turns that into a sentence about what the Premium
 * plan adds — not a wall, not an empty chart, and not a crash.
 *
 * An empty chart with no explanation is the same mistake as a dead upgrade button in a different
 * costume: it looks like the product is broken when in fact it is working exactly as sold.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AnalyticsPanels } from '@/components/analytics-panels';
import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse, SchoolAnalyticsResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Analytics · GetConnected' };
export const dynamic = 'force-dynamic';

const WINDOWS = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last year' },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: requested } = await searchParams;
  const days = WINDOWS.some((window) => String(window.days) === requested) ? Number(requested) : 30;

  let account: CurrentAccountResponse;
  let analytics: SchoolAnalyticsResponse | undefined;
  let notInPlan: string | undefined;

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
    analytics = await readAsUser<SchoolAnalyticsResponse>(
      `/schools/${account.id}/analytics?days=${String(days)}`,
    );
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/school/analytics');
    // The one error this page handles rather than throws: it is not a failure, it is the product
    // working as sold, and the message the API sent already says which plan includes it.
    if (error instanceof ApiError && error.code === 'FEATURE_NOT_IN_PLAN') {
      notInPlan = error.message;
    } else {
      throw error;
    }
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How your school is using ConnectEd, and how much of what you publish is being read."
      />

      {notInPlan ? (
        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Not on your plan yet</h2>
          <p>{notInPlan}</p>
          <p style={{ marginBottom: 0 }}>
            {/* Where to go, rather than a button that would do nothing — self-service checkout
                does not exist yet, and the billing page says so honestly. */}
            <Link href="/school/billing">See your plan</Link>
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
          <nav aria-label="Period" style={{ display: 'flex', gap: 'var(--ui-space-3)' }}>
            {WINDOWS.map((window) => (
              <Link
                key={window.days}
                href={`/school/analytics?days=${String(window.days)}`}
                aria-current={window.days === days ? 'page' : undefined}
              >
                {window.label}
              </Link>
            ))}
          </nav>

          {analytics ? <AnalyticsPanels analytics={analytics} /> : null}
        </div>
      )}
    </>
  );
}
