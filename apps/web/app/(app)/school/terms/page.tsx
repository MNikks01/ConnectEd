/**
 * Terms, from the school's side (FR-GRADE-030, FR-GRADE-031).
 *
 * The product had no notion of a term until report cards needed one, and a card is "the term's"
 * work. Only the school can define one, so this page is the gate everything downstream waits on: a
 * class teacher with no term to choose from cannot issue anything.
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { TermForm } from '@/components/term-form';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse, TermResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms · GetConnected' };
export const dynamic = 'force-dynamic';

export default async function SchoolTermsPage() {
  let account: CurrentAccountResponse;
  let terms: TermResponse[];

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
    if (account.accountType !== 'SCHOOL') redirect('/home');

    terms = (await readAsUser<{ data: TermResponse[] }>(`/schools/${account.id}/terms`)).data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/school/terms');
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Terms"
        description="The periods a report card covers. Ranges may not overlap, because an assessment has to belong to one term or none."
      />

      <section aria-label="Your terms" style={{ marginBottom: 'var(--ui-space-5)' }}>
        {terms.length === 0 ? (
          <Card>
            <p style={{ margin: 0 }}>
              You have not set up any terms yet. Until you do, nobody can issue a report card.
            </p>
          </Card>
        ) : (
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: 'left' }}>
                    Term
                  </th>
                  <th scope="col" style={{ textAlign: 'left' }}>
                    From
                  </th>
                  <th scope="col" style={{ textAlign: 'left' }}>
                    To
                  </th>
                  <th scope="col" style={{ textAlign: 'left' }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={term.id}>
                    <td>{term.name}</td>
                    <td>{term.startDate}</td>
                    <td>{term.endDate}</td>
                    {/* Said plainly, and with the reason: the dates are printed on documents
                        families are holding, so moving them would change what those documents
                        claim (FR-GRADE-031). */}
                    <td>
                      {term.frozen ? 'Cards issued — dates are now fixed' : 'No cards issued yet'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-font-size-3)' }}>Add a term</h2>
        <TermForm schoolId={account.id} />
      </Card>
    </>
  );
}
