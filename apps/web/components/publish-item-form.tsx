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

const TYPE_LABELS: Record<string, string> = {
  [AcademicItemType.HOMEWORK]: 'Homework',
  [AcademicItemType.ASSIGNMENT]: 'Assignment',
  [AcademicItemType.PROJECT]: 'Project',
};

function TypeField() {
  return (
    <Field
      name="type"
      label="Type"
      as="select"
      required
      error={useFieldError('type')}
      options={Object.values(AcademicItemType).map((value) => ({
        value,
        label: TYPE_LABELS[value] ?? value,
      }))}
    />
  );
}

function SubjectField({ subjects }: { subjects: SubjectResponse[] }) {
  return (
    <Field
      name="subjectId"
      label="Subject"
      as="select"
      required
      error={useFieldError('subjectId')}
      hint="You can only publish to a subject your school has allocated to you."
      options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
    />
  );
}

function TitleField() {
  return (
    <Field name="title" label="Title" required maxLength={200} error={useFieldError('title')} />
  );
}

function BodyField() {
  return (
    <Field
      name="body"
      label="Details"
      as="textarea"
      rows={5}
      required
      maxLength={10_000}
      error={useFieldError('body')}
    />
  );
}

function DueField() {
  return (
    <Field
      name="dueAt"
      label="Due"
      type="datetime-local"
      error={useFieldError('dueAt')}
      hint="Optional."
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
  return (
    <ActionForm
      action={publishAcademicItemAction.bind(null, classId)}
      submitLabel="Publish"
      pendingLabel="Publishing…"
      successMessage="Published. Everyone in the class has been notified."
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
