'use client';

import { Alert } from '@connected/ui';

import { allocateClassTeacherAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';
import { useTranslations } from './locale-provider';

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
  const { t } = useTranslations();
  const error = useFieldError('teacherAccountId');
  const errorId = 'teacherAccountId-error';

  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor="teacherAccountId">
        {t('classTeacherForm.teacher')}
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
  const { t } = useTranslations();

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      {current ? (
        <Alert tone="success" title={t('classTeacherForm.currentTitle')}>
          {current.teacherName ?? current.teacherAccountId}
        </Alert>
      ) : (
        <Alert tone="warning" title={t('classTeacherForm.noneTitle')}>
          {t('classTeacherForm.noneBody')}
        </Alert>
      )}

      {teachers.length === 0 ? (
        <Alert tone="info" title={t('classTeacherForm.noTeachersTitle')}>
          {t('classTeacherForm.noTeachersBody')}
        </Alert>
      ) : (
        <ActionForm
          action={allocateClassTeacherAction.bind(null, classId)}
          submitLabel={current ? t('classTeacherForm.replace') : t('classTeacherForm.allocate')}
          pendingLabel={t('classTeacherForm.saving')}
          successMessage={t('classTeacherForm.allocated')}
        >
          <TeacherSelect teachers={teachers} />
        </ActionForm>
      )}
    </div>
  );
}
