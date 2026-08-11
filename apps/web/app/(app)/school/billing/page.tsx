/**
 * Billing (FR-BILL-001, 003). The school's own plan, what it allows, and how much is in use.
 *
 * The permission matrix gives `Manage subscription/billing` a single ✅, in the School column —
 * not the principal's. So this lives in the school portal and nowhere else, and the API refuses
 * the principal independently: this page's absence from their navigation is convenience, not
 * security.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { PlanUsage } from '@/components/plan-usage';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';
import { formatDate } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locales';
import type { MessageKey, Translator } from '@/lib/i18n/translate';
import { getTranslations } from '@/lib/i18n/server';

import type { CurrentAccountResponse, SubscriptionResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('billing.metaTitle') };
}
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, MessageKey> = {
  TRIALING: 'billing.statusTRIALING',
  ACTIVE: 'billing.statusACTIVE',
  PAST_DUE: 'billing.statusPAST_DUE',
  CANCELED: 'billing.statusCANCELED',
};

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * What the status means, in the words a school would use.
 *
 * Each of these describes behaviour the API actually implements. `PAST_DUE` keeping full access is
 * a real decision, not reassurance — so it is safe to say, and worth saying to someone who has
 * just seen "payment failed" and is wondering whether their timetable is about to disappear.
 */
function statusExplanation(
  subscription: SubscriptionResponse,
  t: Translator,
  locale: Locale,
): string {
  const { status, periodEnd } = subscription;

  if (status === 'TRIALING' && periodEnd) {
    const days = daysUntil(periodEnd);

    // The day count is a phrase from the catalogue, not a number with a word after it. English
    // needs two forms and Hindi needs a different pair, and neither survives `days + ' days'`.
    return t('billing.trialing', {
      date: formatDate(periodEnd, locale),
      days: days === 1 ? t('billing.dayOne') : t('billing.dayMany', { count: days }),
    });
  }

  if (status === 'PAST_DUE') return t('billing.pastDue');
  if (status === 'CANCELED') return t('billing.cancelled');

  if (status === 'ACTIVE' && periodEnd) {
    return t('billing.renews', { date: formatDate(periodEnd, locale) });
  }

  return t('billing.freeLimits');
}

export default async function BillingPage() {
  const { t, locale } = await getTranslations();

  let account: CurrentAccountResponse;
  let subscription: SubscriptionResponse;

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
    subscription = await readAsUser<SubscriptionResponse>(`/schools/${account.id}/subscription`);
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/school/billing');
    throw error;
  }

  const status = subscription.status;

  return (
    <>
      <PageHeader title={t('billing.title')} description={t('billing.description')} />

      <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
        <Card as="section">
          <div
            style={{
              display: 'flex',
              gap: 'var(--ui-space-3)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 'var(--ui-text-lg)' }}>{subscription.planName}</h2>
            {status ? (
              <Badge tone={status === 'PAST_DUE' ? 'warning' : 'info'}>
                {status in STATUS_LABEL ? t(STATUS_LABEL[status] as MessageKey) : status}
              </Badge>
            ) : null}
          </div>

          <p style={{ marginBottom: 0 }}>{statusExplanation(subscription, t, locale)}</p>
        </Card>

        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
            {t('billing.usageHeading')}
          </h2>
          <PlanUsage limits={subscription.limits} usage={subscription.usage} />

          <p className="muted" style={{ marginBottom: 0 }}>
            {/* Said here rather than only in the error, so a school reads it before it is stopped
                rather than at the moment it is. */}
            {t('billing.usageNote')}
          </p>
        </Card>

        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
            {t('billing.changeHeading')}
          </h2>
          <p style={{ marginBottom: 0 }}>
            {/* Deliberately not a button. Checkout waits on the payment provider decision
                (ADR-0015), and a control that looks live and does nothing is worse than its
                absence — particularly on the page where someone is trying to give us money. */}
            {t('billing.changeNote')}
          </p>
        </Card>
      </div>
    </>
  );
}
