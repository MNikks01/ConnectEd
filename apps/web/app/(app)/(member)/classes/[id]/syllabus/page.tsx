/**
 * Syllabus coverage for a class, subject by subject (FR-ACAD-030, 031).
 *
 * One page for the whole class rather than one per subject: the question a parent actually asks is
 * "how far has the class got", and answering it one subject at a time would need six navigations.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { SyllabusPanel } from '@/components/syllabus-panel';
import { ApiError } from '@/lib/api-client';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { MyMembershipResponse, SyllabusCoverageResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('syllabusPage.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function SyllabusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getTranslations();

  let coverage: SyllabusCoverageResponse[];
  let isTeacher = false;

  try {
    // One class-scoped request, authorized once. Asking per subject would leave a class with no
    // subjects unauthorized entirely — a stranger could tell an empty class from a missing one.
    coverage = (await readAsUser<{ data: SyllabusCoverageResponse[] }>(`/classes/${id}/syllabus`))
      .data;

    const memberships = (await readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships'))
      .data;
    // A UX gate only: the API refuses recording for a subject this teacher is not allocated to.
    isTeacher = memberships.some((membership) => membership.role === 'TEACHER');
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect(`/api/auth/refresh?next=/classes/${id}/syllabus`);
    }
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href={`/classes/${id}`}>{t('syllabusPage.backToClass')}</Link>
      </p>

      <PageHeader title={t('syllabusPage.title')} description={t('syllabusPage.description')} />

      {coverage.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{t('syllabusPage.noSubjects')}</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
          {coverage.map((subject) => (
            <Card as="section" key={subject.subjectId}>
              <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
                {subject.subjectName ?? t('syllabusPage.subjectFallback')}
              </h2>
              <SyllabusPanel coverage={subject} canRecord={isTeacher} />
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
