'use client';

/**
 * Creating and cancelling events, for the school portal.
 */
import { Button, Dialog, Field } from '@connected/ui';
import { useState, useTransition } from 'react';

import { createEventAction, deleteEventAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';

import type { EventResponse } from '@connected/types';

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
      rows={4}
      required
      maxLength={10_000}
      error={useFieldError('body')}
    />
  );
}

function WhenField() {
  return (
    <Field
      name="eventAt"
      label="When"
      type="datetime-local"
      required
      error={useFieldError('eventAt')}
    />
  );
}

export function EventComposer({ schoolId }: { schoolId: string }) {
  return (
    <ActionForm
      action={createEventAction.bind(null, schoolId)}
      submitLabel="Add event"
      pendingLabel="Adding…"
      successMessage="Event added. Everyone at the school has been notified."
      resetOnSuccess
    >
      <TitleField />
      <WhenField />
      <BodyField />
    </ActionForm>
  );
}

export function EventList({ events }: { events: EventResponse[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<EventResponse | undefined>();

  if (events.length === 0) {
    return <p className="muted">Nothing scheduled. Add the first event below.</p>;
  }

  return (
    <>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
        {events.map((event) => (
          <li key={event.id} className="ui-card">
            <p className="muted" style={{ margin: 0, fontSize: 'var(--ui-text-sm)' }}>
              {new Date(event.eventAt).toLocaleString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
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
