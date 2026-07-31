/**
 * A single class: subjects (FR-INST-003) and the class teacher (FR-INST-004).
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ClassTeacherForm } from '@/components/class-teacher-form';
import { SubjectPanel } from '@/components/subject-panel';
import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type {
  ClassResponse,
  ClassTeacherResponse,
  CurrentAccountResponse,
  SubjectResponse,
} from '@connected/types';

export const dynamic = 'force-dynamic';

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let klass: ClassResponse | undefined;
  let subjects: SubjectResponse[];
  let classTeacher: ClassTeacherResponse | undefined;

  try {
    const account = await readAsUser<CurrentAccountResponse>('/me');

    // There is no single-class endpoint yet; the list is small and already authorized.
    const classes = await readAsUser<{ data: ClassResponse[] }>(
      `/schools/${account.id}/classes?includeInactive=true`,
    );
    klass = classes.data.find((candidate) => candidate.id === id);
    if (!klass) notFound();

    subjects = (await readAsUser<{ data: SubjectResponse[] }>(`/classes/${id}/subjects`)).data;

    try {
      classTeacher = await readAsUser<ClassTeacherResponse>(`/classes/${id}/class-teacher`);
    } catch (error) {
      // A class with no class teacher yet is the normal starting state, not an error.
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect(`/api/auth/refresh?next=/school/classes/${id}`);
    }
    throw error;
  }

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href="/school/classes">← All classes</Link>
      </p>

      <PageHeader
        title={klass.displayName}
        description={`${klass.subjectCount} subject${klass.subjectCount === 1 ? '' : 's'} · ${klass.active ? 'Active' : 'Inactive'}`}
      />

      <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Subjects</h2>
          <SubjectPanel classId={id} subjects={subjects} />
        </Card>

        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Class teacher</h2>
          <ClassTeacherForm classId={id} current={classTeacher} />
        </Card>
      </div>
    </>
  );
}
