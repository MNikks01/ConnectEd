'use client';

import { Field, Table } from '@connected/ui';

import { createSubjectAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';
import { useTranslations } from './locale-provider';

import type { SubjectResponse } from '@connected/types';

function SubjectNameField() {
  const { t } = useTranslations();

  return (
    <Field
      name="name"
      label={t('subjectPanel.name')}
      required
      error={useFieldError('name')}
      hint={t('subjectPanel.nameHint')}
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
  const { t } = useTranslations();

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
      <Table
        caption={t('subjectPanel.caption')}
        captionVisible={false}
        columns={[
          {
            key: 'name',
            header: t('subjectPanel.colName'),
            render: (s: SubjectResponse) => s.name,
          },
        ]}
        rows={subjects}
        rowKey={(subject) => subject.id}
        empty="No subjects yet. Add the first one below."
      />

      <ActionForm
        action={createSubjectAction.bind(null, classId)}
        submitLabel={t('subjectPanel.submit')}
        pendingLabel={t('subjectPanel.adding')}
        successMessage={t('subjectPanel.added')}
        resetOnSuccess
      >
        <SubjectNameField />
      </ActionForm>
    </div>
  );
}
