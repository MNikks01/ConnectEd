'use client';

/**
 * Publishing and withdrawing notices, for the school portal.
 *
 * Deleting is confirmed, unlike publishing: a notice the whole school has already read cannot be
 * un-sent, and the button sits next to nothing else that is destructive.
 */
import { Button, Dialog, Field } from '@connected/ui';
import { useState, useTransition } from 'react';

import { deleteNoticeAction, publishNoticeAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';

import type { NoticeResponse } from '@connected/types';

function TitleField() {
  return (
    <Field name="title" label="Title" required maxLength={200} error={useFieldError('title')} />
  );
}

function BodyField() {
  return (
    <Field
      name="body"
      label="Notice"
      as="textarea"
      rows={5}
      required
      maxLength={10_000}
      error={useFieldError('body')}
      hint="Everyone verified at the school is notified."
    />
  );
}

export function NoticeComposer({ schoolId }: { schoolId: string }) {
  return (
    <ActionForm
      action={publishNoticeAction.bind(null, schoolId)}
      submitLabel="Publish notice"
      pendingLabel="Publishing…"
      successMessage="Notice published. Everyone at the school has been notified."
      resetOnSuccess
    >
      <TitleField />
      <BodyField />
    </ActionForm>
  );
}

export function NoticeList({ notices }: { notices: NoticeResponse[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<NoticeResponse | undefined>();

  if (notices.length === 0) {
    return <p className="muted">No notices yet. The first one goes out from the form below.</p>;
  }

  return (
    <>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
        {notices.map((notice) => (
          <li key={notice.id} className="ui-card">
            <p className="muted" style={{ margin: 0, fontSize: 'var(--ui-text-sm)' }}>
              {new Date(notice.createdAt).toLocaleDateString('en-GB')} ·{' '}
              {notice.authorName ?? 'School'} · read by {notice.readCount ?? 0}
            </p>

            <h3 style={{ margin: '0.25rem 0 0.5rem', fontSize: 'var(--ui-text-base)' }}>
              {notice.title}
            </h3>

            <p style={{ margin: '0 0 var(--ui-space-3)', whiteSpace: 'pre-wrap' }}>{notice.body}</p>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setConfirming(notice);
              }}
            >
              Withdraw
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={confirming !== undefined}
        title="Withdraw this notice?"
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
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => {
                const target = confirming;
                if (!target) return;

                setError(undefined);

                startTransition(async () => {
                  const result = await deleteNoticeAction(target.id);

                  if (!result.ok) {
                    setError(result.message ?? 'That could not be withdrawn. Try again.');
                    return;
                  }

                  setConfirming(undefined);
                });
              }}
            >
              Withdraw notice
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
          It disappears from every member&rsquo;s list. Anyone who has already read it will have
          seen it.
        </p>
      </Dialog>
    </>
  );
}
