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

function NameField() {
  return (
    <Field
      name="name"
      label="Name"
      required
      maxLength={60}
      error={useFieldError('name')}
      // Free text on purpose: "Term 1", "Michaelmas", "First Semester" are all somebody's real
      // answer, and a fixed list would be wrong for most of them.
      hint="Whatever your school calls it — “Term 1”, “Michaelmas”."
    />
  );
}

function StartField() {
  return (
    <Field
      name="startDate"
      label="First day"
      type="date"
      required
      error={useFieldError('startDate')}
    />
  );
}

function EndField() {
  return (
    <Field
      name="endDate"
      label="Last day"
      type="date"
      required
      error={useFieldError('endDate')}
      hint="Terms may not overlap — an assessment has to belong to one term or none."
    />
  );
}

export function TermForm({ schoolId }: { schoolId: string }) {
  return (
    <ActionForm
      action={(formData) => createTermAction(schoolId, formData)}
      submitLabel="Add the term"
      pendingLabel="Adding…"
      successMessage="Added. Class teachers can now issue report cards against it."
    >
      <NameField />
      <StartField />
      <EndField />
    </ActionForm>
  );
}
