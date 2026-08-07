/**
 * Marking one assessment (FR-GRADE-010, 011).
 *
 * Only the people the API lets through get here — the subject's teacher sees the grid, the class
 * teacher and principal see published results, and everyone else gets a 404 from the endpoint
 * rather than a decision made in this file.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { MarkEntry } from '@/components/mark-entry';
import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { AssessmentWithMarksResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Marking · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function MarkAssessmentPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  const { id, assessmentId } = await params;

  let assessment: AssessmentWithMarksResponse;

  try {
    assessment = await readAsUser<AssessmentWithMarksResponse>(
      `/assessments/${assessmentId}/marks`,
    );
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect(`/api/auth/refresh?next=/classes/${id}/marks/${assessmentId}`);
    }
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const roster = assessment.marks.map((mark) => ({
    accountId: mark.studentAccountId,
    name: mark.studentName,
  }));

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href={`/classes/${id}/marks`}>← Back to marks</Link>
      </p>

      <PageHeader
        title={assessment.title}
        description={`${assessment.subjectName} · ${assessment.kind.toLowerCase()} · ${assessment.occurredOn}`}
      />

      {roster.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            This class has no verified pupils yet, so there is nobody to mark.
          </p>
        </Card>
      ) : (
        <MarkEntry assessment={assessment} classId={id} roster={roster} />
      )}
    </main>
  );
}
