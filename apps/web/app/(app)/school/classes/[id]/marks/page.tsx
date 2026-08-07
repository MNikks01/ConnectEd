/**
 * A class's assessments, for the school (S8-3).
 *
 * The school account could already read every mark in its own school — including drafts, because it
 * owns the data and has to be able to take over from a teacher who has left. It had nowhere to read
 * them. This is that place, and it is read-only on purpose: a school that wants a mark changed
 * should ask the teacher who gave it, and the audit trail should say a teacher changed it.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { AssessmentResponse, AssessmentWithMarksResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Marks · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function SchoolClassMarksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let assessments: AssessmentResponse[];

  try {
    assessments = (await readAsUser<{ data: AssessmentResponse[] }>(`/classes/${id}/assessments`))
      .data;
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect(`/api/auth/refresh?next=/school/classes/${id}/marks`);
    }
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  // Each assessment's marks are fetched separately — the list endpoint deliberately carries no
  // marks, so that "which assessments exist" and "what did each child get" stay different
  // questions with different permission checks behind them.
  const withMarks = await Promise.all(
    assessments.map(async (assessment) => {
      try {
        return await readAsUser<AssessmentWithMarksResponse>(`/assessments/${assessment.id}/marks`);
      } catch {
        // A single unreadable assessment must not blank the page. It is shown without its marks.
        return { ...assessment, marks: [] };
      }
    }),
  );

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href={`/school/classes/${id}`}>← Back to the class</Link>
      </p>

      <PageHeader
        title="Marks"
        description="Everything this class has been assessed on, including work not yet published."
      />

      {withMarks.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>This class has no assessments yet.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
          {withMarks.map((assessment) => (
            <Card key={assessment.id}>
              <h2 style={{ margin: '0 0 var(--ui-space-1)', fontSize: 'var(--ui-font-size-3)' }}>
                {assessment.title}
              </h2>
              <p style={{ margin: '0 0 var(--ui-space-3)', color: 'var(--ui-color-text-muted)' }}>
                {assessment.subjectName} · {assessment.kind.toLowerCase()} · {assessment.occurredOn}{' '}
                · out of {assessment.maxScore} ·{' '}
                {assessment.publishedAt ? 'published' : 'draft — the class cannot see this'}
              </p>

              {assessment.marks.length === 0 ? (
                <p style={{ margin: 0 }}>Nobody has been marked yet.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <caption
                    style={{ captionSide: 'top', textAlign: 'left', paddingBottom: '0.5rem' }}
                  >
                    {assessment.marks.length} pupils
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: 'left' }}>
                        Pupil
                      </th>
                      <th scope="col" style={{ textAlign: 'left' }}>
                        Score
                      </th>
                      <th scope="col" style={{ textAlign: 'left' }}>
                        Remark
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.marks.map((mark) => (
                      <tr key={mark.studentAccountId}>
                        <td>{mark.studentName}</td>
                        {/* "Not marked" rather than a blank cell or a zero — the distinction the
                            rest of the feature is careful about, kept here too. */}
                        <td>{mark.score === null ? 'Not marked' : mark.score}</td>
                        <td>{mark.remark ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
