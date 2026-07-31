'use client';

import { Field } from '@connected/ui';

import { updateSchoolProfileAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';

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
  return (
    <ActionForm
      action={updateSchoolProfileAction.bind(null, schoolId)}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      successMessage="Profile updated."
    >
      <ProfileField name="name" label="School name" defaultValue={profile.name} />
      <ProfileField name="adminName" label="Administrator" defaultValue={profile.adminName} />
      <ProfileField name="phone" label="Phone" type="tel" defaultValue={profile.phone} />
      <ProfileField name="city" label="City" defaultValue={profile.city} />
      <ProfileField name="state" label="State" defaultValue={profile.state} />
      <ProfileField name="country" label="Country" defaultValue={profile.country} />
      <ProfileField
        name="establishmentYear"
        label="Established"
        type="number"
        defaultValue={profile.establishmentYear}
        hint="The year the school opened."
      />
      <ProfileField name="affiliation" label="Affiliation" defaultValue={profile.affiliation} />
    </ActionForm>
  );
}
