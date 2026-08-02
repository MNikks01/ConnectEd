'use client';

/**
 * Follow, connect, message, block, report — everything you can do *to* an account.
 *
 * Blocking is confirmed and the confirmation says what it does, because it is the one action here
 * that changes what the other person can see of you as well as what you see of them.
 */
import { Button, Dialog } from '@connected/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  blockAction,
  followAction,
  reportAction,
  requestConnectionAction,
  startThreadAction,
} from '@/app/(app)/(member)/actions';
import { ActionForm, useFieldError } from './action-form';

import { Field } from '@connected/ui';

function ReasonField() {
  return (
    <Field
      name="reason"
      label="What is wrong?"
      as="textarea"
      rows={3}
      required
      maxLength={2000}
      error={useFieldError('reason')}
    />
  );
}

export function ProfileActions({
  accountId,
  following,
  connectionState,
  blocked,
}: {
  accountId: string;
  following: boolean;
  connectionState: 'none' | 'pending' | 'connected';
  blocked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [reporting, setReporting] = useState(false);

  function act(action: () => Promise<{ ok: boolean; message?: string }>, then?: () => void) {
    setError(undefined);

    startTransition(async () => {
      const result = await action();
      if (result.ok) then?.();
      else setError(result.message);
    });
  }

  if (blocked) {
    return (
      <div>
        <p className="muted">You have blocked this account.</p>
        <Button
          variant="secondary"
          loading={pending}
          onClick={() => {
            act(() => blockAction(accountId, true));
          }}
        >
          Unblock
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-3)' }}>
      {error ? (
        <p className="ui-field__error" role="alert">
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 'var(--ui-space-3)', flexWrap: 'wrap' }}>
        <Button
          loading={pending}
          onClick={() => {
            act(() => followAction(accountId, following));
          }}
        >
          {following ? 'Unfollow' : 'Follow'}
        </Button>

        {connectionState === 'none' ? (
          <Button
            variant="secondary"
            loading={pending}
            onClick={() => {
              act(() => requestConnectionAction(accountId));
            }}
          >
            Connect
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            {connectionState === 'pending' ? 'Request sent' : 'Connected'}
          </Button>
        )}

        <Button
          variant="secondary"
          loading={pending}
          onClick={() => {
            act(
              () => startThreadAction(accountId),
              () => {
                router.push('/messages');
              },
            );
          }}
        >
          Message
        </Button>

        <Button
          variant="secondary"
          onClick={() => {
            setReporting((open) => !open);
          }}
          aria-expanded={reporting}
        >
          Report
        </Button>

        <Button
          variant="danger"
          onClick={() => {
            setConfirmingBlock(true);
          }}
        >
          Block
        </Button>
      </div>

      {reporting ? (
        <ActionForm
          action={reportAction.bind(null, 'ACCOUNT', accountId)}
          submitLabel="Send report"
          pendingLabel="Sending…"
          successMessage="Reported. Nobody at your school is told."
        >
          <ReasonField />
        </ActionForm>
      ) : null}

      <Dialog
        open={confirmingBlock}
        title="Block this account?"
        onClose={() => {
          setConfirmingBlock(false);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmingBlock(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => {
                act(
                  () => blockAction(accountId, false),
                  () => {
                    setConfirmingBlock(false);
                  },
                );
              }}
            >
              Block
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          You will not see each other&rsquo;s posts, comments or messages, in either direction.
          Unblocking puts everything back — nothing is deleted.
        </p>
      </Dialog>
    </div>
  );
}
