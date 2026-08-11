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
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('security.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const { t } = await getTranslations();

  let account: CurrentAccountResponse;

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/settings/security');
    throw error;
  }

  // ConnectEd staff too (ASVS 4.3.1). The moderation queue is the most privileged surface in the
  // product, and until 2026-08-11 the one interface the standard singles out for MFA was the only
  // one whose holders could not enrol.
  const mayEnrol =
    account.accountType === 'SCHOOL' || account.role === 'PRINCIPAL' || account.isPlatformAdmin;

  return (
    <>
      <PageHeader title={t('security.title')} description={t('security.description')} />

      {mayEnrol ? (
        <TwoFactorSetup enabled={account.twoFactorEnabled} />
      ) : (
        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
            {t('security.twoFactorHeading')}
          </h2>
          {/* Explained rather than hidden. Every enrolled account is one more person who can be
              locked out by a lost phone, so it is offered where it buys the most. */}
          <p style={{ marginBottom: 0 }}>{t('security.notAvailable')}</p>
        </Card>
      )}
    </>
  );
}
