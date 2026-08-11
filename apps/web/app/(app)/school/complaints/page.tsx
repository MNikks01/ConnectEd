/**
 * The complaints queue, from the school's side (FR-WF-011).
 */
import { PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FeedbackQueue } from '@/components/feedback-forms';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';
import type { MessageKey } from '@/lib/i18n/translate';
import { getTranslations } from '@/lib/i18n/server';

import type { CurrentAccountResponse, FeedbackResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('schoolComplaints.metaTitle') };
}
export const dynamic = 'force-dynamic';

const FILTERS: { value: string; label: MessageKey }[] = [
  { value: '', label: 'schoolComplaints.all' },
  { value: 'OPEN', label: 'schoolComplaints.open' },
  { value: 'UNDER_REVIEW', label: 'schoolComplaints.underReview' },
  { value: 'RESOLVED', label: 'schoolComplaints.resolved' },
];

export default async function SchoolComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { t } = await getTranslations();

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
        title={t('schoolComplaints.title')}
        description={t('schoolComplaints.description')}
      />

      <nav
        aria-label={t('schoolComplaints.statusNav')}
        style={{ marginBottom: 'var(--ui-space-4)' }}
      >
        <ul className="filter-tabs">
          {FILTERS.map((filter) => (
            <li key={filter.value || 'all'}>
              <Link
                href={
                  filter.value ? `/school/complaints?status=${filter.value}` : '/school/complaints'
                }
                aria-current={filter.value === status ? 'page' : undefined}
              >
                {t(filter.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <FeedbackQueue items={items} canReview />
    </>
  );
}
