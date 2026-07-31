/**
 * The verification queue (FR-VER-005). This is the screen the whole workflow exists for: nobody
 * reaches academic data until someone here approves them.
 */
import { PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { VerificationQueue } from '@/components/verification-queue';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse, VerificationRequestResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Verifications · GetConnected' };
export const dynamic = 'force-dynamic';

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'PENDING' } = await searchParams;

  let requests: VerificationRequestResponse[];

  try {
    const account = await readAsUser<CurrentAccountResponse>('/me');
    const response = await readAsUser<{ data: VerificationRequestResponse[] }>(
      `/schools/${account.id}/verifications?status=${encodeURIComponent(status)}`,
    );
    requests = response.data;
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect('/api/auth/refresh?next=/school/verifications');
    }
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Verifications"
        description="Approve a request and the member gains access to that class immediately. Reject it and they can apply again."
      />

      <VerificationQueue requests={requests} status={status} />
    </>
  );
}
