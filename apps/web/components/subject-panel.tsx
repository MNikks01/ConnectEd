'use client';

import { Field, Table } from '@connected/ui';

import { createSubjectAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';

import type { SubjectResponse } from '@connected/types';

function SubjectNameField() {
  return (
    <Field
      name="name"
      label="Subject name"
      required
      error={useFieldError('name')}
      hint="Shown to teachers when they declare what they teach."
    />
  );
}

export function SubjectPanel({
  classId,
  subjects,
}: {
  classId: string;
  subjects: SubjectResponse[];
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
      <Table
        caption="Subjects in this class"
        captionVisible={false}
        columns={[{ key: 'name', header: 'Name', render: (s: SubjectResponse) => s.name }]}
        rows={subjects}
        rowKey={(subject) => subject.id}
        empty="No subjects yet. Add the first one below."
      />

      <ActionForm
        action={createSubjectAction.bind(null, classId)}
        submitLabel="Add subject"
        pendingLabel="Adding…"
        successMessage="Subject added."
        resetOnSuccess
      >
        <SubjectNameField />
      </ActionForm>
    </div>
  );
}
