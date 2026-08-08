/**
 * A class's report cards, for the school.
 *
 * Read-only, for the same reason the school's marks view is: a school that wants a card changed
 * should ask the class teacher who issued it, and the audit trail should say a teacher reissued it.
 * The school can still issue through the API — it owns the data and has to be able to take over
 * from a teacher who has left — but making that the easy path would quietly move the job.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ReportCardView } from '@/components/report-card';
import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse, ReportCardResponse, TermResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Report cards · GetConnected' };
export const dynamic = 'force-dynamic';

export default async function SchoolClassReportCardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ termId?: string }>;
}) {
  const { id } = await params;
  const { termId } = await searchParams;
  const back = `/school/classes/${id}/report-cards`;

  let account: CurrentAccountResponse;
  let terms: TermResponse[];

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
    if (account.accountType !== 'SCHOOL') redirect('/home');

    terms = (await readAsUser<{ data: TermResponse[] }>(`/schools/${account.id}/terms`)).data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect(`/api/auth/refresh?next=${back}`);
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const selected = termId ?? terms[0]?.id ?? '';
  let cards: ReportCardResponse[] = [];

  if (selected !== '') {
    try {
      cards = (
        await readAsUser<{ data: ReportCardResponse[] }>(
          `/classes/${id}/report-cards?termId=${selected}`,
        )
      ).data;
    } catch (error) {
      if (error instanceof SessionExpiredError) redirect(`/api/auth/refresh?next=${back}`);
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
      throw error;
    }
  }

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href={`/school/classes/${id}`}>← Back to the class</Link>
      </p>

      <PageHeader
        title="Report cards"
        description="What this class's families were given, exactly as it was issued."
      />

      {terms.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            You have not set up any terms yet, so nothing can have been issued.{' '}
            <Link href="/school/terms">Add a term</Link>.
          </p>
        </Card>
      ) : (
        <>
          {terms.length > 1 ? (
            <form method="get" style={{ marginBottom: 'var(--ui-space-4)' }}>
              <label htmlFor="term-picker">Term shown</label>{' '}
              <select id="term-picker" name="termId" defaultValue={selected}>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>{' '}
              <button type="submit">Show</button>
            </form>
          ) : null}

          {cards.length === 0 ? (
            <Card>
              <p style={{ margin: 0 }}>
                No cards have been issued for this class in this term. The class teacher issues
                them.
              </p>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
              {cards.map((card) => (
                <ReportCardView key={card.id} card={card} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
