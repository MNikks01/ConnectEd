/**
 * The complaints queue, from the school's side (FR-WF-011).
 */
import { PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FeedbackQueue } from '@/components/feedback-forms';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse, FeedbackResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Complaints · GetConnected' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Not yet read' },
  { value: 'UNDER_REVIEW', label: 'Being looked at' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export default async function SchoolComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = '' } = await searchParams;

  let items: FeedbackResponse[];

  try {
    const account = await readAsUser<CurrentAccountResponse>('/me');
    if (account.accountType !== 'SCHOOL') redirect('/home');

    items = (
      await readAsUser<{ data: FeedbackResponse[] }>(
        `/schools/${account.id}/feedback${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      )
    ).data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/school/complaints');
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Complaints and suggestions"
        description="From parents and staff. The person who raised each one is named."
      />

      <nav aria-label="Status" style={{ marginBottom: 'var(--ui-space-4)' }}>
        <ul className="filter-tabs">
          {FILTERS.map((filter) => (
            <li key={filter.value || 'all'}>
              <Link
                href={
                  filter.value ? `/school/complaints?status=${filter.value}` : '/school/complaints'
                }
                aria-current={filter.value === status ? 'page' : undefined}
              >
                {filter.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <FeedbackQueue items={items} canReview />
    </>
  );
}
