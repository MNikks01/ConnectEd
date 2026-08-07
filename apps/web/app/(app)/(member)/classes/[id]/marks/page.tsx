/**
 * Marks for a class (FR-GRADE-020 … 023).
 *
 * **One route, three audiences, and the difference is not cosmetic.** A pupil sees their own marks;
 * a parent sees their child's, resolved through the link the school confirmed; a teacher sees the
 * assessments they mark. The page never merges those into one list — it asks a different endpoint
 * for each, so a mistake in the layout cannot show one person another's result.
 *
 * The API is the authority either way: every branch here is a *view* decision, and each endpoint
 * refuses the callers it should regardless of what this page renders.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AssessmentComposer } from '@/components/assessment-composer';
import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type {
  AssessmentResponse,
  MyMarkResponse,
  MyMembershipResponse,
  MyTeachingSubjectResponse,
} from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Marks · GetConnected' };

export const dynamic = 'force-dynamic';

/** A score against its maximum, or the honest absence of one. */
function ScoreLine({ mark, maxScore }: { mark: MyMarkResponse['mark']; maxScore: string }) {
  if (!mark || mark.score === null) {
    // Not "0", and not blank. A pupil who was absent has no score, and saying so is kinder and
    // more accurate than a zero they did not earn (FR-GRADE-014).
    return <span>Not marked</span>;
  }

  return (
    <span>
      <strong>{mark.score}</strong> out of {maxScore}
    </span>
  );
}

function MarkList({ marks, emptyMessage }: { marks: MyMarkResponse[]; emptyMessage: string }) {
  if (marks.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      {marks.map((assessment) => (
        <Card key={assessment.id}>
          <h2 style={{ margin: '0 0 var(--ui-space-2)', fontSize: 'var(--ui-font-size-3)' }}>
            {assessment.title}
          </h2>
          <p style={{ margin: '0 0 var(--ui-space-2)', color: 'var(--ui-color-text-muted)' }}>
            {assessment.subjectName} · {assessment.kind.toLowerCase()} · {assessment.occurredOn}
          </p>
          <p style={{ margin: 0 }}>
            <ScoreLine mark={assessment.mark} maxScore={assessment.maxScore} />
          </p>
          {assessment.mark?.remark ? (
            <p style={{ margin: 'var(--ui-space-2) 0 0' }}>{assessment.mark.remark}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export default async function MarksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let memberships: MyMembershipResponse[] = [];

  try {
    memberships = (await readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships')).data;
  } catch (error) {
    if (error instanceof SessionExpiredError)
      redirect(`/api/auth/refresh?next=/classes/${id}/marks`);
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const forThisClass = memberships.filter((membership) => membership.classId === id);
  const asPupil = forThisClass.find((membership) => membership.role === 'STUDENT');
  // A parent's membership names the child, which is what `/children/:id/marks` needs. Two children
  // in one class would produce two memberships, and each gets its own section rather than a merged
  // list nobody could read correctly.
  const asParent = forThisClass.filter((membership) => membership.role === 'PARENT');
  const teaches = memberships.some(
    (membership) => membership.role === 'TEACHER' || membership.role === 'PRINCIPAL',
  );

  let mine: MyMarkResponse[] = [];
  const childrens: { name: string; marks: MyMarkResponse[]; unlinked: boolean }[] = [];
  let assessments: AssessmentResponse[] = [];
  let teachingHere: MyTeachingSubjectResponse[] = [];

  try {
    if (asPupil) {
      mine = (await readAsUser<{ data: MyMarkResponse[] }>(`/me/classes/${id}/marks`)).data;
    }

    for (const membership of asParent) {
      if (!membership.childId) continue;

      try {
        const marks = (
          await readAsUser<{ data: MyMarkResponse[] }>(`/children/${membership.childId}/marks`)
        ).data;
        childrens.push({ name: membership.childName ?? 'Your child', marks, unlinked: false });
      } catch (error) {
        // 404 here means the school has not yet confirmed which pupil this child is. That is a
        // thing to explain, not an error page: the parent has done nothing wrong and there is
        // nothing they can do about it either.
        if (error instanceof ApiError && error.status === 404) {
          childrens.push({ name: membership.childName ?? 'Your child', marks: [], unlinked: true });
        } else {
          throw error;
        }
      }
    }

    if (teaches) {
      assessments = (await readAsUser<{ data: AssessmentResponse[] }>(`/classes/${id}/assessments`))
        .data;

      // Only the subjects this teacher is allocated to *in this class* — the picker must not offer
      // a subject the server will refuse.
      teachingHere = (
        await readAsUser<{ data: MyTeachingSubjectResponse[] }>('/me/subjects')
      ).data.filter((subject) => subject.classId === id);
    }
  } catch (error) {
    if (error instanceof SessionExpiredError)
      redirect(`/api/auth/refresh?next=/classes/${id}/marks`);
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href={`/classes/${id}`}>← Back to the class</Link>
      </p>

      <PageHeader title="Marks" description="Results for assessments this class has sat." />

      {asPupil ? <MarkList marks={mine} emptyMessage="No marks have been published yet." /> : null}

      {childrens.map((child) => (
        <section key={child.name} style={{ marginTop: 'var(--ui-space-5)' }}>
          <h2 style={{ fontSize: 'var(--ui-font-size-3)' }}>{child.name}</h2>
          {child.unlinked ? (
            <Card>
              <p style={{ margin: 0 }}>
                Your school has not yet linked {child.name} to their student account, so their marks
                cannot be shown here. Ask the school to link them.
              </p>
            </Card>
          ) : (
            <MarkList marks={child.marks} emptyMessage="No marks have been published yet." />
          )}
        </section>
      ))}

      {teaches ? (
        <section style={{ marginTop: 'var(--ui-space-5)' }}>
          <h2 style={{ fontSize: 'var(--ui-font-size-3)' }}>Assessments</h2>

          <Card>
            <h3 style={{ marginTop: 0, fontSize: 'var(--ui-font-size-2)' }}>New assessment</h3>
            <AssessmentComposer classId={id} subjects={teachingHere} />
          </Card>

          {assessments.length === 0 ? (
            <Card>
              <p style={{ margin: 0 }}>No assessments yet.</p>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--ui-space-3)' }}>
              {assessments.map((assessment) => (
                <Card key={assessment.id}>
                  <p style={{ margin: 0 }}>
                    <Link href={`/classes/${id}/marks/${assessment.id}`}>{assessment.title}</Link>
                  </p>
                  <p
                    style={{
                      margin: 'var(--ui-space-1) 0 0',
                      color: 'var(--ui-color-text-muted)',
                    }}
                  >
                    {assessment.subjectName} · out of {assessment.maxScore} ·{' '}
                    {assessment.publishedAt ? 'published' : 'draft — not visible to the class'}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!asPupil && childrens.length === 0 && !teaches ? (
        <Card>
          <p style={{ margin: 0 }}>There are no marks for you to see in this class.</p>
        </Card>
      ) : null}
    </main>
  );
}
