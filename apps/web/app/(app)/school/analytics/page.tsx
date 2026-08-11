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
import type { MessageKey } from '@/lib/i18n/translate';
import { getTranslations } from '@/lib/i18n/server';

import type { CurrentAccountResponse, SchoolAnalyticsResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('schoolAnalytics.metaTitle') };
}
export const dynamic = 'force-dynamic';

const WINDOWS: { days: number; label: MessageKey }[] = [
  { days: 30, label: 'schoolAnalytics.last30' },
  { days: 90, label: 'schoolAnalytics.last90' },
  { days: 365, label: 'schoolAnalytics.lastYear' },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { t } = await getTranslations();

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
        title={t('schoolAnalytics.title')}
        description={t('schoolAnalytics.description')}
      />

      {notInPlan ? (
        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
            {t('schoolAnalytics.notInPlan')}
          </h2>
          <p>{notInPlan}</p>
          <p style={{ marginBottom: 0 }}>
            {/* Where to go, rather than a button that would do nothing — self-service checkout
                does not exist yet, and the billing page says so honestly. */}
            <Link href="/school/billing">{t('schoolAnalytics.seePlan')}</Link>
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
          <nav
            aria-label={t('schoolAnalytics.periodNav')}
            style={{ display: 'flex', gap: 'var(--ui-space-3)' }}
          >
            {WINDOWS.map((window) => (
              <Link
                key={window.days}
                href={`/school/analytics?days=${String(window.days)}`}
                aria-current={window.days === days ? 'page' : undefined}
              >
                {t(window.label)}
              </Link>
            ))}
          </nav>

          {analytics ? <AnalyticsPanels analytics={analytics} /> : null}
        </div>
      )}
    </>
  );
}
