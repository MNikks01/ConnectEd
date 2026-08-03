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

import type { CurrentAccountResponse, SubscriptionResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Billing · GetConnected' };
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  TRIALING: 'Trial',
  ACTIVE: 'Active',
  PAST_DUE: 'Payment failed',
  CANCELED: 'Cancelled',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

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
function statusExplanation(subscription: SubscriptionResponse): string {
  const { status, periodEnd } = subscription;

  if (status === 'TRIALING' && periodEnd) {
    const days = daysUntil(periodEnd);
    return (
      `Your trial runs until ${formatDate(periodEnd)} — ${String(days)} ` +
      `${days === 1 ? 'day' : 'days'} left. After that you will need a paid plan to add beyond ` +
      `the trial limits. Everything you have already created stays exactly as it is.`
    );
  }

  if (status === 'PAST_DUE') {
    return (
      'A payment did not go through. Nothing has changed for your staff or students — you keep ' +
      'everything your plan allows while this is sorted out.'
    );
  }

  if (status === 'CANCELED') {
    return (
      'Your subscription has been cancelled, so the free limits apply from here. Nothing has ' +
      'been deleted: every class and member you already have is untouched, and you can add ' +
      'again once you subscribe.'
    );
  }

  if (status === 'ACTIVE' && periodEnd) {
    return `Your plan renews on ${formatDate(periodEnd)}.`;
  }

  return 'Your school is on the free limits.';
}

export default async function BillingPage() {
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
      <PageHeader
        title="Billing"
        description="Your plan, what it allows, and how much of it you are using."
      />

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
                {STATUS_LABEL[status] ?? status}
              </Badge>
            ) : null}
          </div>

          <p style={{ marginBottom: 0 }}>{statusExplanation(subscription)}</p>
        </Card>

        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>What you are using</h2>
          <PlanUsage limits={subscription.limits} usage={subscription.usage} />

          <p className="muted" style={{ marginBottom: 0 }}>
            {/* Said here rather than only in the error, so a school reads it before it is stopped
                rather than at the moment it is. */}
            Reaching a limit stops you adding new ones. It never removes or hides anything you
            already have.
          </p>
        </Card>

        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Changing your plan</h2>
          <p style={{ marginBottom: 0 }}>
            {/* Deliberately not a button. Checkout waits on the payment provider decision
                (ADR-0015), and a control that looks live and does nothing is worse than its
                absence — particularly on the page where someone is trying to give us money. */}
            Self-service upgrades are not available yet. Speak to your ConnectEd contact to move to
            a larger plan, and your limits change the same day.
          </p>
        </Card>
      </div>
    </>
  );
}
