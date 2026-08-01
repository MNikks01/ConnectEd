/**
 * Notices, from the school's side (FR-ACAD-010).
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { NoticeComposer, NoticeList } from '@/components/notice-admin';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse, NoticeResponse, Paginated } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Notices · GetConnected' };
export const dynamic = 'force-dynamic';

export default async function SchoolNoticesPage() {
  let account: CurrentAccountResponse;
  let notices: Paginated<NoticeResponse>;

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');

    // The layout redirects an individual away, but Next renders layout and page in parallel — so
    // without this the page still fires a request the API is certain to refuse, and logs a 403
    // that describes the framework rather than anything the user did.
    if (account.accountType !== 'SCHOOL') redirect('/home');

    notices = await readAsUser<Paginated<NoticeResponse>>(`/schools/${account.id}/notices`);
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/school/notices');
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Notices"
        description="Anything published here reaches every verified member of the school."
      />

      <section aria-label="Published notices">
        <NoticeList notices={notices.data} />
      </section>

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Publish a notice</h2>
        <NoticeComposer schoolId={account.id} />
      </Card>
    </>
  );
}
