'use client';

/**
 * Publishing homework, an assignment, or a project (FR-ACAD-001).
 *
 * The subject list is every subject in the class, not just the ones this teacher is allocated to —
 * the API has that list and refuses the rest, and duplicating the allocation rule here would be a
 * second copy of an authorization decision that is allowed to drift.
 */
import { AcademicItemType, type SubjectResponse } from '@connected/types';
import { Field } from '@connected/ui';

import { publishAcademicItemAction } from '@/app/(app)/(member)/actions';
import { ActionForm, useFieldError } from './action-form';
import type { MessageKey } from '@/lib/i18n/translate';
import { useTranslations } from './locale-provider';

const TYPE_LABELS: Record<string, MessageKey> = {
  [AcademicItemType.HOMEWORK]: 'publishForm.typeHOMEWORK',
  [AcademicItemType.ASSIGNMENT]: 'publishForm.typeASSIGNMENT',
  [AcademicItemType.PROJECT]: 'publishForm.typePROJECT',
};

function TypeField() {
  const { t } = useTranslations();

  return (
    <Field
      name="type"
      label={t('publishForm.type')}
      as="select"
      required
      error={useFieldError('type')}
      options={Object.values(AcademicItemType).map((value) => ({
        value,
        label: value in TYPE_LABELS ? t(TYPE_LABELS[value] as MessageKey) : value,
      }))}
    />
  );
}

function SubjectField({ subjects }: { subjects: SubjectResponse[] }) {
  const { t } = useTranslations();

  return (
    <Field
      name="subjectId"
      label={t('publishForm.subject')}
      as="select"
      required
      error={useFieldError('subjectId')}
      hint={t('publishForm.subjectHint')}
      options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
    />
  );
}

function TitleField() {
  const { t } = useTranslations();

  return (
    <Field
      name="title"
      label={t('publishForm.title')}
      required
      maxLength={200}
      error={useFieldError('title')}
    />
  );
}

function BodyField() {
  const { t } = useTranslations();

  return (
    <Field
      name="body"
      label={t('publishForm.details')}
      as="textarea"
      rows={5}
      required
      maxLength={10_000}
      error={useFieldError('body')}
    />
  );
}

function DueField() {
  const { t } = useTranslations();

  return (
    <Field
      name="dueAt"
      label={t('publishForm.due')}
      type="datetime-local"
      error={useFieldError('dueAt')}
      hint={t('publishForm.dueHint')}
    />
  );
}

export function PublishItemForm({
  classId,
  subjects,
}: {
  classId: string;
  subjects: SubjectResponse[];
}) {
  const { t } = useTranslations();

  return (
    <ActionForm
      action={publishAcademicItemAction.bind(null, classId)}
      submitLabel={t('publishForm.submit')}
      pendingLabel={t('publishForm.publishing')}
      successMessage={t('publishForm.published')}
      resetOnSuccess
    >
      <TypeField />
      <SubjectField subjects={subjects} />
      <TitleField />
      <BodyField />
      <DueField />
    </ActionForm>
  );
}
