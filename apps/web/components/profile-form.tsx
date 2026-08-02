'use client';

/**
 * Editing your own profile (FR-SOC-001).
 *
 * The visibility control says what each option means rather than naming it — "only my connections"
 * is a decision someone can make, "CONNECTIONS" is a value in an enum.
 */
import { Field } from '@connected/ui';

import { updateOwnProfileAction } from '@/app/(app)/(member)/actions';
import { ActionForm, useFieldError } from './action-form';

import type { ProfileResponse } from '@connected/types';

export function ProfileForm({ profile }: { profile: ProfileResponse }) {
  return (
    <ActionForm
      action={updateOwnProfileAction}
      submitLabel="Save profile"
      pendingLabel="Saving…"
      successMessage="Profile updated."
    >
      <Field
        name="fullName"
        label="Name"
        defaultValue={profile.displayName}
        required
        maxLength={120}
        error={useFieldError('fullName')}
      />

      <Field
        name="bio"
        label="About you"
        as="textarea"
        rows={3}
        maxLength={1000}
        defaultValue={profile.bio ?? ''}
        error={useFieldError('bio')}
      />

      <Field
        name="achievements"
        label="Achievements"
        as="textarea"
        rows={3}
        maxLength={2000}
        defaultValue={profile.achievements ?? ''}
        error={useFieldError('achievements')}
      />

      <Field
        name="visibility"
        label="Who can see the details above"
        as="select"
        defaultValue={profile.visibility ?? 'PUBLIC'}
        error={useFieldError('visibility')}
        hint="Your name and picture are always visible, so people can find you to connect."
        options={[
          { value: 'PUBLIC', label: 'Anyone signed in' },
          { value: 'CONNECTIONS', label: 'Only my connections' },
        ]}
      />
    </ActionForm>
  );
}
