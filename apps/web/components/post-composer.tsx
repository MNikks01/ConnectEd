'use client';

/**
 * Writing a post. Deliberately plain: text and nothing else in v1, because an image needs an
 * upload flow and the API's `imageKey` is ready for it whenever that lands.
 */
import { Field } from '@connected/ui';

import { publishPostAction } from '@/app/(app)/(member)/actions';
import { ActionForm, useFieldError } from './action-form';

function BodyField() {
  return (
    <Field
      name="body"
      label="Say something"
      as="textarea"
      rows={3}
      required
      maxLength={5000}
      error={useFieldError('body')}
      hint="Anyone who follows or is connected to you can see this."
    />
  );
}

export function PostComposer() {
  return (
    <ActionForm
      action={publishPostAction}
      submitLabel="Post"
      pendingLabel="Posting…"
      successMessage="Posted."
      resetOnSuccess
    >
      <BodyField />
    </ActionForm>
  );
}
