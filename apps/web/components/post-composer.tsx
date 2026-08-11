'use client';

/**
 * Writing a post. Deliberately plain: text and nothing else in v1, because an image needs an
 * upload flow and the API's `imageKey` is ready for it whenever that lands.
 */
import { Field } from '@connected/ui';

import { publishPostAction } from '@/app/(app)/(member)/actions';
import { ActionForm, useFieldError } from './action-form';
import { useTranslations } from './locale-provider';

function BodyField() {
  const { t } = useTranslations();

  return (
    <Field
      name="body"
      label={t('post.saySomething')}
      as="textarea"
      rows={3}
      required
      maxLength={5000}
      error={useFieldError('body')}
      hint={t('post.composerHint')}
    />
  );
}

export function PostComposer() {
  const { t } = useTranslations();

  return (
    <ActionForm
      action={publishPostAction}
      submitLabel={t('post.post')}
      pendingLabel={t('post.posting')}
      successMessage={t('post.posted')}
      resetOnSuccess
    >
      <BodyField />
    </ActionForm>
  );
}
