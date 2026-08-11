/**
 * Member roster (FR-INST-005). Who the school has verified, and the ability to remove them.
 */
import { PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { MemberRoster } from '@/components/member-roster';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';
import { getTranslations } from '@/lib/i18n/server';

import type { CurrentAccountResponse, SchoolMemberResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('schoolMembers.metaTitle') };
}
export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const { t } = await getTranslations();

  let members: SchoolMemberResponse[];
  let schoolId: string;

  try {
    const account = await readAsUser<CurrentAccountResponse>('/me');
    schoolId = account.id;
    members = (await readAsUser<{ data: SchoolMemberResponse[] }>(`/schools/${schoolId}/members`))
      .data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/school/members');
    throw error;
  }

  return (
    <>
      <PageHeader title={t('schoolMembers.title')} description={t('schoolMembers.description')} />

      <MemberRoster schoolId={schoolId} members={members} />
    </>
  );
}
