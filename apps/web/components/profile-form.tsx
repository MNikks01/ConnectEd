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
import { useTranslations } from './locale-provider';

import type { ProfileResponse } from '@connected/types';

export function ProfileForm({ profile }: { profile: ProfileResponse }) {
  const { t } = useTranslations();

  return (
    <ActionForm
      action={updateOwnProfileAction}
      submitLabel={t('profileForm.submit')}
      pendingLabel={t('profileForm.saving')}
      successMessage={t('profileForm.saved')}
    >
      <Field
        name="fullName"
        label={t('profileForm.name')}
        defaultValue={profile.displayName}
        required
        maxLength={120}
        error={useFieldError('fullName')}
      />

      <Field
        name="bio"
        label={t('profileForm.about')}
        as="textarea"
        rows={3}
        maxLength={1000}
        defaultValue={profile.bio ?? ''}
        error={useFieldError('bio')}
      />

      <Field
        name="achievements"
        label={t('profileForm.achievements')}
        as="textarea"
        rows={3}
        maxLength={2000}
        defaultValue={profile.achievements ?? ''}
        error={useFieldError('achievements')}
      />

      <Field
        name="visibility"
        label={t('profileForm.visibility')}
        as="select"
        defaultValue={profile.visibility ?? 'PUBLIC'}
        error={useFieldError('visibility')}
        hint={t('profileForm.visibilityHint')}
        options={[
          { value: 'PUBLIC', label: t('profileForm.public') },
          { value: 'CONNECTIONS', label: t('profileForm.connectionsOnly') },
        ]}
      />
    </ActionForm>
  );
}
