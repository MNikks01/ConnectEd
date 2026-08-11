/**
 * School profile (FR-INST-001). Server Component reads; a Server Action writes.
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { SchoolProfileForm } from '@/components/school-profile-form';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';
import { getTranslations } from '@/lib/i18n/server';

import type { CurrentAccountResponse, SchoolProfileResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('schoolProfile.metaTitle') };
}
export const dynamic = 'force-dynamic';

export default async function SchoolProfilePage() {
  const { t } = await getTranslations();

  let account: CurrentAccountResponse;
  let profile: SchoolProfileResponse;

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
    profile = await readAsUser<SchoolProfileResponse>(`/schools/${account.id}`);
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/school');
    throw error;
  }

  return (
    <>
      <PageHeader title={t('schoolProfile.title')} description={t('schoolProfile.description')} />

      <Card as="section">
        <SchoolProfileForm schoolId={account.id} profile={profile} />
      </Card>
    </>
  );
}
