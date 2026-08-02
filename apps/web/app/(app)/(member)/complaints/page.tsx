/**
 * Complaints and suggestions, from a member's side (FR-WF-010, 012).
 *
 * Only what *this* person raised is listed. The school's queue is a different page in a different
 * part of the app, and a parent cannot reach it — the API refuses, and so does this.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FeedbackForm, FeedbackHistory } from '@/components/feedback-forms';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { FeedbackResponse, MyMembershipResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Complaints · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const { school } = await searchParams;

  let memberships: MyMembershipResponse[];
  let mine: FeedbackResponse[];

  try {
    [memberships, mine] = await Promise.all([
      readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships').then((r) => r.data),
      readAsUser<{ data: FeedbackResponse[] }>('/me/feedback').then((r) => r.data),
    ]);
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/complaints');
    throw error;
  }

  // Students are not offered the form: the module is hidden from them, and the API refuses anyway.
  const eligible = [
    ...new Map(
      memberships
        .filter((membership) => membership.role !== 'STUDENT')
        .map((membership) => [membership.schoolId, membership.schoolName ?? 'Your school']),
    ).entries(),
  ].map(([id, name]) => ({ id, name }));

  const schoolId = eligible.some((entry) => entry.id === school) ? school : eligible[0]?.id;

  return (
    <main>
      <PageHeader
        title="Complaints and suggestions"
        description="Raised with your school, and answered by it."
      />

      {eligible.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            Complaints are raised by parents and staff. Once a school has verified you in one of
            those roles, the form appears here.
          </p>
        </Card>
      ) : (
        <>
          {eligible.length > 1 ? (
            <nav aria-label="School" style={{ marginBottom: 'var(--ui-space-4)' }}>
              <ul className="filter-tabs">
                {eligible.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/complaints?school=${entry.id}`}
                      aria-current={entry.id === schoolId ? 'page' : undefined}
                    >
                      {entry.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <Card as="section">
            <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Raise something</h2>
            <FeedbackForm schoolId={schoolId ?? ''} />
          </Card>
        </>
      )}

      <section style={{ marginTop: 'var(--ui-space-5)' }}>
        <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>What you have raised</h2>
        <FeedbackHistory items={mine} />
      </section>
    </main>
  );
}
