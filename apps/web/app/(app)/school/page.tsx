/**
 * School profile (FR-INST-001). Server Component reads; a Server Action writes.
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { SchoolProfileForm } from '@/components/school-profile-form';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse, SchoolProfileResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'School profile · GetConnected' };
export const dynamic = 'force-dynamic';

export default async function SchoolProfilePage() {
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
      <PageHeader
        title="School profile"
        description="What members and visitors see. Everything here is editable."
      />

      <Card as="section">
        <SchoolProfileForm schoolId={account.id} profile={profile} />
      </Card>
    </>
  );
}
