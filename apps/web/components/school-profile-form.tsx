'use client';

import { Field } from '@connected/ui';

import { updateSchoolProfileAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';
import { useTranslations } from './locale-provider';

import type { SchoolProfileResponse } from '@connected/types';

/** Reads its own server-side error from context, so each control shows the message that caused it. */
function ProfileField({
  name,
  label,
  defaultValue,
  hint,
  type,
}: {
  name: string;
  label: string;
  defaultValue: string | number | null;
  hint?: string;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 'var(--ui-space-4)' }}>
      <Field
        name={name}
        label={label}
        type={type}
        hint={hint}
        defaultValue={defaultValue ?? ''}
        error={useFieldError(name)}
      />
    </div>
  );
}

export function SchoolProfileForm({
  schoolId,
  profile,
}: {
  schoolId: string;
  profile: SchoolProfileResponse;
}) {
  const { t } = useTranslations();

  return (
    <ActionForm
      action={updateSchoolProfileAction.bind(null, schoolId)}
      submitLabel={t('schoolProfileForm.submit')}
      pendingLabel={t('schoolProfileForm.saving')}
      successMessage={t('schoolProfileForm.saved')}
    >
      <ProfileField name="name" label={t('schoolProfileForm.name')} defaultValue={profile.name} />
      <ProfileField
        name="adminName"
        label={t('schoolProfileForm.adminName')}
        defaultValue={profile.adminName}
      />
      <ProfileField
        name="phone"
        label={t('schoolProfileForm.phone')}
        type="tel"
        defaultValue={profile.phone}
      />
      <ProfileField name="city" label={t('schoolProfileForm.city')} defaultValue={profile.city} />
      <ProfileField
        name="state"
        label={t('schoolProfileForm.state')}
        defaultValue={profile.state}
      />
      <ProfileField
        name="country"
        label={t('schoolProfileForm.country')}
        defaultValue={profile.country}
      />
      <ProfileField
        name="establishmentYear"
        label={t('schoolProfileForm.established')}
        type="number"
        defaultValue={profile.establishmentYear}
        hint={t('schoolProfileForm.establishedHint')}
      />
      <ProfileField
        name="affiliation"
        label={t('schoolProfileForm.affiliation')}
        defaultValue={profile.affiliation}
      />
    </ActionForm>
  );
}
