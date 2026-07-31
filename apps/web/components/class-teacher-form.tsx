'use client';

import { Alert, Field } from '@connected/ui';

import { allocateClassTeacherAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';

import type { ClassTeacherResponse } from '@connected/types';

function TeacherIdField() {
  return (
    <Field
      name="teacherAccountId"
      label="Teacher account ID"
      required
      error={useFieldError('teacherAccountId')}
      hint="The teacher must already be a verified member of this school."
    />
  );
}

export function ClassTeacherForm({
  classId,
  current,
}: {
  classId: string;
  current?: ClassTeacherResponse;
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      {current ? (
        <Alert tone="success" title="Current class teacher">
          {current.teacherName ?? current.teacherAccountId}
        </Alert>
      ) : (
        <Alert tone="warning" title="No class teacher">
          Student and parent leave for this class cannot be approved until one is allocated.
        </Alert>
      )}

      <ActionForm
        action={allocateClassTeacherAction.bind(null, classId)}
        submitLabel={current ? 'Replace class teacher' : 'Allocate class teacher'}
        pendingLabel="Saving…"
        successMessage="Class teacher allocated."
      >
        <TeacherIdField />
      </ActionForm>
    </div>
  );
}
