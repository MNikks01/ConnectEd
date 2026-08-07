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

import type { MyTeachingSubjectResponse } from '@connected/types';

function SubjectField({ subjects }: { subjects: MyTeachingSubjectResponse[] }) {
  return (
    <Field
      name="subjectId"
      label="Subject"
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
  return (
    <Field
      name="kind"
      label="Kind"
      as="select"
      required
      error={useFieldError('kind')}
      options={[
        { value: 'TEST', label: 'Test' },
        { value: 'EXAM', label: 'Exam' },
        { value: 'ASSIGNMENT', label: 'Assignment' },
        { value: 'PRACTICAL', label: 'Practical' },
      ]}
    />
  );
}

function TitleField() {
  return (
    <Field
      name="title"
      label="Assessment name"
      required
      maxLength={200}
      error={useFieldError('title')}
      hint="What the class will see it called, like “Fractions test”."
    />
  );
}

function MaxScoreField() {
  return (
    <Field
      name="maxScore"
      label="Out of"
      required
      inputMode="decimal"
      error={useFieldError('maxScore')}
      hint="The total every mark is read against."
    />
  );
}

function OccurredOnField() {
  return (
    <Field
      name="occurredOn"
      label="Date sat"
      type="date"
      required
      error={useFieldError('occurredOn')}
      // The day it was sat, not the day it is being entered — a teacher marking on Sunday is
      // recording Friday's test, and a report card ordered by the wrong date is wrong quietly.
      hint="The day the class sat it, not today."
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
  if (subjects.length === 0) {
    // Not an empty form nobody can submit: a teacher with no subject in this class has nothing to
    // assess, and saying so is more use than a disabled control.
    return <p>You are not allocated to a subject in this class, so there is nothing to assess.</p>;
  }

  return (
    <ActionForm
      action={(formData) => createAssessmentAction(classId, formData)}
      submitLabel="Create assessment"
      pendingLabel="Creating…"
      successMessage="Created. Enter the marks when you are ready — nobody sees them until you publish."
    >
      <SubjectField subjects={subjects} />
      <KindField />
      <TitleField />
      <MaxScoreField />
      <OccurredOnField />
    </ActionForm>
  );
}
