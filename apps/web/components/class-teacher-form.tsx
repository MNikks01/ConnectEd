'use client';

import { Alert } from '@connected/ui';

import { allocateClassTeacherAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';

import type { ClassTeacherResponse, SchoolMemberResponse } from '@connected/types';

/**
 * A picker over the school's verified teachers, not a field to paste an account UUID into.
 *
 * The first version of this screen asked for the id directly. It was correct — the API rejects
 * anyone who is not a verified teacher — but no school administrator has a UUID to hand, so the
 * feature was unusable. The roster makes the real list available, which is why S1-10 came before
 * anything new.
 */
function TeacherSelect({ teachers }: { teachers: SchoolMemberResponse[] }) {
  const error = useFieldError('teacherAccountId');
  const errorId = 'teacherAccountId-error';

  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor="teacherAccountId">
        Teacher
      </label>
      <select
        id="teacherAccountId"
        name="teacherAccountId"
        className="ui-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {teachers.map((teacher) => (
          <option key={teacher.accountId} value={teacher.accountId}>
            {teacher.fullName ?? teacher.handle ?? teacher.accountId}
          </option>
        ))}
      </select>
      {error ? (
        <span className="ui-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function ClassTeacherForm({
  classId,
  current,
  teachers,
}: {
  classId: string;
  current?: ClassTeacherResponse;
  teachers: SchoolMemberResponse[];
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

      {teachers.length === 0 ? (
        <Alert tone="info" title="No teachers to allocate">
          Verify a teacher for this school first — they appear here once approved.
        </Alert>
      ) : (
        <ActionForm
          action={allocateClassTeacherAction.bind(null, classId)}
          submitLabel={current ? 'Replace class teacher' : 'Allocate class teacher'}
          pendingLabel="Saving…"
          successMessage="Class teacher allocated."
        >
          <TeacherSelect teachers={teachers} />
        </ActionForm>
      )}
    </div>
  );
}
