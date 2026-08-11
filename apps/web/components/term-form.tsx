'use client';

/**
 * Defining a term, for the school (FR-GRADE-030).
 *
 * The school's alone, because terms differ by board and country and only the school knows its own.
 * Nothing else in the product can be issued until one exists, which is why this is the first thing
 * on the page rather than a setting buried somewhere.
 *
 * Overlap is refused by the server, not here. The API answers a clash with the name of the term it
 * clashes with, and that message is worth more than anything this form could guess at — so it is
 * shown as it arrives.
 */
import { Field } from '@connected/ui';

import { createTermAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';
import { useTranslations } from './locale-provider';

function NameField() {
  const { t } = useTranslations();

  return (
    <Field
      name="name"
      label={t('termForm.name')}
      required
      maxLength={60}
      error={useFieldError('name')}
      // Free text on purpose: "Term 1", "Michaelmas", "First Semester" are all somebody's real
      // answer, and a fixed list would be wrong for most of them.
      hint={t('termForm.nameHint')}
    />
  );
}

function StartField() {
  const { t } = useTranslations();

  return (
    <Field
      name="startDate"
      label={t('termForm.firstDay')}
      type="date"
      required
      error={useFieldError('startDate')}
    />
  );
}

function EndField() {
  const { t } = useTranslations();

  return (
    <Field
      name="endDate"
      label={t('termForm.lastDay')}
      type="date"
      required
      error={useFieldError('endDate')}
      hint={t('termForm.lastDayHint')}
    />
  );
}

export function TermForm({ schoolId }: { schoolId: string }) {
  const { t } = useTranslations();

  return (
    <ActionForm
      action={(formData) => createTermAction(schoolId, formData)}
      submitLabel={t('termForm.submit')}
      pendingLabel={t('termForm.adding')}
      successMessage={t('termForm.added')}
    >
      <NameField />
      <StartField />
      <EndField />
    </ActionForm>
  );
}
