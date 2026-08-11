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
import { useTranslations } from './locale-provider';

import type { MyMembershipResponse } from '@connected/types';

function DateFields() {
  const { t } = useTranslations();

  return (
    <>
      <Field
        name="startDate"
        label={t('leaveForms.firstDay')}
        type="date"
        required
        error={useFieldError('startDate')}
      />
      <Field
        name="endDate"
        label={t('leaveForms.lastDay')}
        type="date"
        required
        error={useFieldError('endDate')}
      />
    </>
  );
}

function ReasonField() {
  const { t } = useTranslations();

  return (
    <Field
      name="reason"
      label={t('leaveForms.reason')}
      as="textarea"
      rows={3}
      required
      maxLength={2000}
      error={useFieldError('reason')}
      hint={t('leaveForms.reasonHint')}
    />
  );
}

export function ApplyForChildForm({ children }: { children: MyMembershipResponse[] }) {
  const { t } = useTranslations();

  return (
    <ActionForm
      action={applyForChildLeaveAction}
      submitLabel={t('leaveForms.submit')}
      pendingLabel={t('leaveForms.sending')}
      successMessage={t('leaveForms.sentToClassTeacher')}
      resetOnSuccess
    >
      <Field
        name="childId"
        label={t('leaveForms.child')}
        as="select"
        required
        error={useFieldError('childId')}
        options={children.map((membership) => ({
          value: membership.childId ?? '',
          label: t('leaveForms.childOption', {
            child: membership.childName ?? t('leaveForms.childFallback'),
            className: membership.className ?? t('leaveForms.classFallback'),
          }),
        }))}
      />
      <DateFields />
      <ReasonField />
    </ActionForm>
  );
}

export function ApplyForSelfForm({ schools }: { schools: { id: string; name: string }[] }) {
  const { t } = useTranslations();

  return (
    <ActionForm
      action={applyForOwnLeaveAction}
      submitLabel={t('leaveForms.submit')}
      pendingLabel={t('leaveForms.sending')}
      successMessage={t('leaveForms.sentToPrincipal')}
      resetOnSuccess
    >
      {schools.length > 1 ? (
        <Field
          name="schoolId"
          label={t('leaveForms.school')}
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
