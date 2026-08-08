/**
 * A single class: subjects (FR-INST-003) and the class teacher (FR-INST-004).
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ClassTeacherForm } from '@/components/class-teacher-form';
import { SubjectPanel } from '@/components/subject-panel';
import { TimetableEditor } from '@/components/timetable-editor';
import { TimetablePanel } from '@/components/timetable-panel';
import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type {
  ClassResponse,
  ClassTeacherResponse,
  CurrentAccountResponse,
  SchoolMemberResponse,
  SubjectResponse,
  TimetableResponse,
} from '@connected/types';

export const dynamic = 'force-dynamic';

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let klass: ClassResponse | undefined;
  let subjects: SubjectResponse[];
  let classTeacher: ClassTeacherResponse | undefined;
  let teachers: SchoolMemberResponse[] = [];
  let timetable: TimetableResponse | undefined;

  try {
    const account = await readAsUser<CurrentAccountResponse>('/me');

    // There is no single-class endpoint yet; the list is small and already authorized.
    const classes = await readAsUser<{ data: ClassResponse[] }>(
      `/schools/${account.id}/classes?includeInactive=true`,
    );
    klass = classes.data.find((candidate) => candidate.id === id);
    if (!klass) notFound();

    subjects = (await readAsUser<{ data: SubjectResponse[] }>(`/classes/${id}/subjects`)).data;

    // The roster is what turns allocation into a picker rather than a UUID field.
    const members = await readAsUser<{ data: SchoolMemberResponse[] }>(
      `/schools/${account.id}/members`,
    );
    teachers = members.data.filter((member) => member.role === 'TEACHER');

    try {
      classTeacher = await readAsUser<ClassTeacherResponse>(`/classes/${id}/class-teacher`);
    } catch (error) {
      // A class with no class teacher yet is the normal starting state, not an error.
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }

    try {
      timetable = await readAsUser<TimetableResponse>(`/classes/${id}/timetable`);
    } catch (error) {
      // Likewise: no timetable uploaded yet is the starting state.
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

      <p>
        <Link href={`/school/classes/${id}/marks`}>Marks</Link>
        {' · '}
        <Link href={`/school/classes/${id}/report-cards`}>Report cards</Link>
      </p>

      <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Subjects</h2>
          <SubjectPanel classId={id} subjects={subjects} />
        </Card>

        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Class teacher</h2>
          <ClassTeacherForm classId={id} current={classTeacher} teachers={teachers} />
        </Card>

        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Timetable</h2>
          {/*
            Two ways to publish the same thing, side by side, because they suit different schools
            rather than different stages. A photograph of the sheet on the wall is thirty seconds
            of work; a structured week takes longer and is the only one the server can check for
            clashes. Whichever is published becomes the next version.
          */}
          <TimetablePanel classId={id} timetable={timetable} />

          <h3 style={{ fontSize: 'var(--ui-text-base)', marginBottom: 'var(--ui-space-2)' }}>
            Or build the week
          </h3>
          <TimetableEditor classId={id} subjects={subjects} />
        </Card>
      </div>
    </>
  );
}
