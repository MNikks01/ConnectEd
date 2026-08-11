/**
 * Your data — export and erasure (`.docs/PRD/14-export-and-erasure.md`).
 *
 * One page for both rights, deliberately. They are the two halves of the same question — "what do
 * you have about me, and will you stop having it" — and splitting them across two screens would
 * mean somebody looking for the second finds only the first and concludes the answer is no.
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { PrivacyPanel } from '@/components/privacy-panel';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { DataExportResponse, PrivacyStatusResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('privacy.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const { t } = await getTranslations();

  let status: PrivacyStatusResponse;
  let exports: DataExportResponse[];

  try {
    const [statusResponse, listResponse] = await Promise.all([
      readAsUser<PrivacyStatusResponse>('/me/privacy'),
      readAsUser<{ data: DataExportResponse[] }>('/me/exports'),
    ]);

    status = statusResponse;
    exports = listResponse.data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/settings/privacy');
    throw error;
  }

  return (
    <>
      <PageHeader title={t('privacy.title')} description={t('privacy.description')} />

      <PrivacyPanel status={status} exports={exports} />

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
          {t('privacy.limitsHeading')}
        </h2>
        {/* Said here rather than left to a privacy notice nobody opens. The product should describe
            what it can actually do — implying more is the failure worth avoiding.

            The emphasis that used to be markup inside this paragraph is gone, and deliberately: a
            translator cannot move a <strong> that is welded to an English word order, and a
            sentence that has to be split into three fragments to keep one bold word is a sentence
            no translator can render. */}
        <p>{t('privacy.limitsBody')}</p>
        <p style={{ marginBottom: 0 }}>{t('privacy.limitsWhatGoes')}</p>
      </Card>
    </>
  );
}
