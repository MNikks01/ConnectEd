'use client';

/**
 * Applying for leave — one form for a parent, another for a teacher.
 *
 * Two components rather than one with a mode, because the two really differ: a parent picks a
 * child, a teacher picks nothing, and the endpoints they post to decide who approves.
 */
import { Field } from '@connected/ui';

import { applyForChildLeaveAction, applyForOwnLeaveAction } from '@/app/(app)/(member)/actions';
import { ActionForm, useFieldError } from './action-form';

import type { MyMembershipResponse } from '@connected/types';

function DateFields() {
  return (
    <>
      <Field
        name="startDate"
        label="First day"
        type="date"
        required
        error={useFieldError('startDate')}
      />
      <Field
        name="endDate"
        label="Last day"
        type="date"
        required
        error={useFieldError('endDate')}
      />
    </>
  );
}

function ReasonField() {
  return (
    <Field
      name="reason"
      label="Reason"
      as="textarea"
      rows={3}
      required
      maxLength={2000}
      error={useFieldError('reason')}
      hint="Seen by whoever decides the application."
    />
  );
}

export function ApplyForChildForm({ children }: { children: MyMembershipResponse[] }) {
  return (
    <ActionForm
      action={applyForChildLeaveAction}
      submitLabel="Apply for leave"
      pendingLabel="Sending…"
      successMessage="Sent to the class teacher."
      resetOnSuccess
    >
      <Field
        name="childId"
        label="Child"
        as="select"
        required
        error={useFieldError('childId')}
        options={children.map((membership) => ({
          value: membership.childId ?? '',
          label: `${membership.childName ?? 'Child'} — ${membership.className ?? 'Class'}`,
        }))}
      />
      <DateFields />
      <ReasonField />
    </ActionForm>
  );
}

export function ApplyForSelfForm({ schools }: { schools: { id: string; name: string }[] }) {
  return (
    <ActionForm
      action={applyForOwnLeaveAction}
      submitLabel="Apply for leave"
      pendingLabel="Sending…"
      successMessage="Sent to the principal."
      resetOnSuccess
    >
      {schools.length > 1 ? (
        <Field
          name="schoolId"
          label="School"
          as="select"
          required
          error={useFieldError('schoolId')}
          options={schools.map((school) => ({ value: school.id, label: school.name }))}
        />
      ) : (
        <input type="hidden" name="schoolId" value={schools[0]?.id ?? ''} />
      )}
      <DateFields />
      <ReasonField />
    </ActionForm>
  );
}
