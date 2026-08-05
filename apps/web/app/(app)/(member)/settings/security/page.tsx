/**
 * Security settings — two-factor authentication (FR-AUTH-012).
 *
 * Offered only to the accounts that may enrol. Someone who cannot is told why rather than shown a
 * button that would 403: the restriction is a judgement about who needs it, and a judgement is
 * worth explaining.
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { TwoFactorSetup } from '@/components/two-factor-setup';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Security · GetConnected' };
export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  let account: CurrentAccountResponse;

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/settings/security');
    throw error;
  }

  const mayEnrol = account.accountType === 'SCHOOL' || account.role === 'PRINCIPAL';

  return (
    <>
      <PageHeader title="Security" description="How you prove it is you." />

      {mayEnrol ? (
        <TwoFactorSetup enabled={account.twoFactorEnabled} />
      ) : (
        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Two-factor authentication</h2>
          <p style={{ marginBottom: 0 }}>
            {/* Explained rather than hidden. Every enrolled account is one more person who can be
                locked out by a lost phone, so it is offered where it buys the most. */}
            Available to school accounts and principals — the accounts that can approve members and
            reach every family at a school. Yours does neither, so a password and a strong one is
            enough.
          </p>
        </Card>
      )}
    </>
  );
}
