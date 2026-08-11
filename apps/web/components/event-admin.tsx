'use client';

/**
 * Creating and cancelling events, for the school portal.
 */
import { Button, Dialog, Field } from '@connected/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { createEventAction, deleteEventAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';
import { formatDateTime } from '@/lib/i18n/format';
import { useTranslations } from './locale-provider';

import type { EventResponse } from '@connected/types';

function TitleField() {
  const { t } = useTranslations();

  return (
    <Field
      name="title"
      label={t('eventAdmin.title')}
      required
      maxLength={200}
      error={useFieldError('title')}
    />
  );
}

function BodyField() {
  const { t } = useTranslations();

  return (
    <Field
      name="body"
      label={t('eventAdmin.details')}
      as="textarea"
      rows={4}
      required
      maxLength={10_000}
      error={useFieldError('body')}
    />
  );
}

function WhenField() {
  const { t } = useTranslations();

  return (
    <Field
      name="eventAt"
      label={t('eventAdmin.when')}
      type="datetime-local"
      required
      error={useFieldError('eventAt')}
    />
  );
}

export function EventComposer({ schoolId }: { schoolId: string }) {
  const { t } = useTranslations();

  return (
    <ActionForm
      action={createEventAction.bind(null, schoolId)}
      submitLabel={t('eventAdmin.submit')}
      pendingLabel={t('eventAdmin.adding')}
      successMessage={t('eventAdmin.added')}
      resetOnSuccess
    >
      <TitleField />
      <WhenField />
      <BodyField />
    </ActionForm>
  );
}

/**
 * Why `router.refresh()` as well as `revalidatePath`.
 *
 * The action already revalidates, and when the action's response is applied the router repaints.
 * `notices.spec.ts:66` has failed three times in CI with the notice still listed after a
 * successful withdrawal, and the one thing that shape needs is for that repaint not to arrive.
 *
 * **This is a mitigation, not a diagnosis.** It has not been reproduced locally — fifteen repeats
 * and an eight-times CPU throttle both pass — so the honest description is: the repaint is the
 * user-visible promise, and it now has two independent ways to happen instead of one. If the
 * failure recurs, `clickUntil` will say what the page actually showed, which three previous
 * failures did not.
 */
export function EventList({ events }: { events: EventResponse[] }) {
  const { t, locale } = useTranslations();

  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<EventResponse | undefined>();

  if (events.length === 0) {
    return <p className="muted">{t('eventAdmin.none')}</p>;
  }

  return (
    <>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
        {events.map((event) => (
          <li key={event.id} className="ui-card">
            <p className="muted" style={{ margin: 0, fontSize: 'var(--ui-text-sm)' }}>
              {formatDateTime(event.eventAt, locale)}
            </p>

            <h3 style={{ margin: '0.25rem 0 0.5rem', fontSize: 'var(--ui-text-base)' }}>
              {event.title}
            </h3>

            <p style={{ margin: '0 0 var(--ui-space-3)', whiteSpace: 'pre-wrap' }}>{event.body}</p>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setConfirming(event);
              }}
            >
              Cancel event
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={confirming !== undefined}
        title="Cancel this event?"
        onClose={() => {
          setError(undefined);
          setConfirming(undefined);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setError(undefined);
                setConfirming(undefined);
              }}
            >
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => {
                const target = confirming;
                if (!target) return;

                setError(undefined);

                startTransition(async () => {
                  const result = await deleteEventAction(target.id);

                  if (!result.ok) {
                    setError(result.message ?? 'That could not be cancelled. Try again.');
                    return;
                  }

                  setConfirming(undefined);
                  router.refresh();
                });
              }}
            >
              Cancel event
            </Button>
          </>
        }
      >
        {error ? (
          <p className="ui-field__error" role="alert">
            {error}
          </p>
        ) : null}

        <p style={{ margin: 0 }}>
          It leaves everyone&rsquo;s calendar. Members are not told separately that it was
          cancelled.
        </p>
      </Dialog>
    </>
  );
}
