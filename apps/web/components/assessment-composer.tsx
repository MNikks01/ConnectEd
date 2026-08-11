'use client';

/**
 * Setting up an assessment, for a teacher (FR-GRADE-001).
 *
 * This screen is the one S7-7 left out, and the reason is worth keeping in view: the end-to-end
 * test created its assessments through the API, so every check passed while the product had no way
 * in. A fixture shortcut is a claim that the front door works — it is not a test of it.
 *
 * The subject is a picker built from the teacher's own allocations, not free text. The server
 * refuses a subject this teacher is not allocated to, and a form that lets somebody type their way
 * into a 403 teaches them the product is broken rather than that the answer was no.
 */
import { Field } from '@connected/ui';

import { createAssessmentAction } from '@/app/(app)/(member)/actions';
import { ActionForm, useFieldError } from './action-form';
import { useTranslations } from './locale-provider';

import type { MyTeachingSubjectResponse } from '@connected/types';

function SubjectField({ subjects }: { subjects: MyTeachingSubjectResponse[] }) {
  const { t } = useTranslations();

  return (
    <Field
      name="subjectId"
      label={t('assessmentComposer.subject')}
      as="select"
      required
      error={useFieldError('subjectId')}
      options={subjects.map((subject) => ({
        value: subject.subjectId,
        label: subject.subjectName,
      }))}
    />
  );
}

function KindField() {
  const { t } = useTranslations();

  return (
    <Field
      name="kind"
      label={t('assessmentComposer.kind')}
      as="select"
      required
      error={useFieldError('kind')}
      options={[
        { value: 'TEST', label: t('assessmentComposer.kindTEST') },
        { value: 'EXAM', label: t('assessmentComposer.kindEXAM') },
        { value: 'ASSIGNMENT', label: t('assessmentComposer.kindASSIGNMENT') },
        { value: 'PRACTICAL', label: t('assessmentComposer.kindPRACTICAL') },
      ]}
    />
  );
}

function TitleField() {
  const { t } = useTranslations();

  return (
    <Field
      name="title"
      label={t('assessmentComposer.name')}
      required
      maxLength={200}
      error={useFieldError('title')}
      hint={t('assessmentComposer.nameHint')}
    />
  );
}

function MaxScoreField() {
  const { t } = useTranslations();

  return (
    <Field
      name="maxScore"
      label={t('assessmentComposer.outOf')}
      required
      inputMode="decimal"
      error={useFieldError('maxScore')}
      hint={t('assessmentComposer.outOfHint')}
    />
  );
}

function OccurredOnField() {
  const { t } = useTranslations();

  return (
    <Field
      name="occurredOn"
      label={t('assessmentComposer.dateSat')}
      type="date"
      required
      error={useFieldError('occurredOn')}
      // The day it was sat, not the day it is being entered — a teacher marking on Sunday is
      // recording Friday's test, and a report card ordered by the wrong date is wrong quietly.
      hint={t('assessmentComposer.dateSatHint')}
    />
  );
}

export function AssessmentComposer({
  classId,
  subjects,
}: {
  classId: string;
  subjects: MyTeachingSubjectResponse[];
}) {
  const { t } = useTranslations();

  if (subjects.length === 0) {
    // Not an empty form nobody can submit: a teacher with no subject in this class has nothing to
    // assess, and saying so is more use than a disabled control.
    return <p>{t('assessmentComposer.noSubjects')}</p>;
  }

  return (
    <ActionForm
      action={(formData) => createAssessmentAction(classId, formData)}
      submitLabel={t('assessmentComposer.submit')}
      pendingLabel={t('assessmentComposer.creating')}
      successMessage={t('assessmentComposer.created')}
    >
      <SubjectField subjects={subjects} />
      <KindField />
      <TitleField />
      <MaxScoreField />
      <OccurredOnField />
    </ActionForm>
  );
}
