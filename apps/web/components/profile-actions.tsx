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
import { useTranslations } from './locale-provider';

import { Field } from '@connected/ui';

function ReasonField() {
  const { t } = useTranslations();

  return (
    <Field
      name="reason"
      label={t('profileActions.reportLabel')}
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
  const { t } = useTranslations();
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
        <p className="muted">{t('profileActions.blockedNotice')}</p>
        <Button
          variant="secondary"
          loading={pending}
          onClick={() => {
            act(() => blockAction(accountId, true));
          }}
        >
          {t('profileActions.unblock')}
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
          {following ? t('profileActions.unfollow') : t('profileActions.follow')}
        </Button>

        {connectionState === 'none' ? (
          <Button
            variant="secondary"
            loading={pending}
            onClick={() => {
              act(() => requestConnectionAction(accountId));
            }}
          >
            {t('profileActions.connect')}
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            {connectionState === 'pending'
              ? t('profileActions.requestSent')
              : t('profileActions.connected')}
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
          {t('profileActions.message')}
        </Button>

        <Button
          variant="secondary"
          onClick={() => {
            setReporting((open) => !open);
          }}
          aria-expanded={reporting}
        >
          {t('profileActions.report')}
        </Button>

        <Button
          variant="danger"
          onClick={() => {
            setConfirmingBlock(true);
          }}
        >
          {t('profileActions.block')}
        </Button>
      </div>

      {reporting ? (
        <ActionForm
          action={reportAction.bind(null, 'ACCOUNT', accountId)}
          submitLabel={t('profileActions.sendReport')}
          pendingLabel={t('profileActions.sending')}
          successMessage={t('profileActions.reported')}
        >
          <ReasonField />
        </ActionForm>
      ) : null}

      <Dialog
        open={confirmingBlock}
        title={t('profileActions.blockTitle')}
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
              {t('profileActions.cancel')}
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
              {t('profileActions.block')}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>{t('profileActions.blockExplained')}</p>
      </Dialog>
    </div>
  );
}
