'use client';

/**
 * Raising a complaint or a suggestion, and the school's side of reviewing them.
 */
import { Badge, Button, Card, Field } from '@connected/ui';
import { useState, useTransition } from 'react';

import { submitFeedbackAction } from '@/app/(app)/(member)/actions';
import { reviewFeedbackAction } from '@/app/(app)/school/actions';
import { formatShortDate } from '@/lib/i18n/format';
import { ActionForm, useFieldError } from './action-form';
import { useTranslations } from './locale-provider';

import type { MessageKey } from '@/lib/i18n/translate';

import type { FeedbackResponse } from '@connected/types';

const STATUS_TONE = {
  OPEN: 'info',
  UNDER_REVIEW: 'warning',
  RESOLVED: 'success',
} as const;

/** Keys, not words — each is resolved where it is rendered so it follows the reader's locale. */
const STATUS_LABEL: Record<string, MessageKey> = {
  OPEN: 'feedback.statusOPEN',
  UNDER_REVIEW: 'feedback.statusUNDER_REVIEW',
  RESOLVED: 'feedback.statusRESOLVED',
};

export function FeedbackForm({ schoolId }: { schoolId: string }) {
  const { t } = useTranslations();

  return (
    <ActionForm
      action={submitFeedbackAction.bind(null, schoolId)}
      submitLabel={t('feedback.submit')}
      pendingLabel={t('feedback.sending')}
      successMessage={t('feedback.sent')}
      resetOnSuccess
    >
      <Field
        name="kind"
        label={t('feedback.kind')}
        as="select"
        required
        error={useFieldError('kind')}
        options={[
          { value: 'COMPLAINT', label: t('feedback.complaint') },
          { value: 'SUGGESTION', label: t('feedback.suggestion') },
        ]}
      />
      <Field
        name="body"
        label={t('feedback.details')}
        as="textarea"
        rows={5}
        required
        maxLength={5000}
        error={useFieldError('body')}
        hint={t('feedback.detailsHint')}
      />
    </ActionForm>
  );
}

/** What the author sees: status, no controls. */
export function FeedbackHistory({ items }: { items: FeedbackResponse[] }) {
  const { t, locale } = useTranslations();

  if (items.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>{t('feedback.noneRaised')}</p>
      </Card>
    );
  }

  return (
    <ul
      aria-label={t('feedback.historyLabel')}
      style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}
    >
      {items.map((item) => (
        <li key={item.id}>
          <Card>
            <div
              style={{
                display: 'flex',
                gap: 'var(--ui-space-2)',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Badge tone="neutral">
                {item.kind === 'COMPLAINT' ? t('feedback.complaint') : t('feedback.suggestion')}
              </Badge>
              <Badge tone={STATUS_TONE[item.status]}>
                {t(STATUS_LABEL[item.status] as MessageKey)}
              </Badge>
              <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                {formatShortDate(item.createdAt, locale)}
              </span>
            </div>

            <p style={{ margin: 'var(--ui-space-2) 0 0', whiteSpace: 'pre-wrap' }}>{item.body}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** The school's queue. Teachers see the same list without these buttons. */
export function FeedbackQueue({
  items,
  canReview,
}: {
  items: FeedbackResponse[];
  canReview: boolean;
}) {
  const { t, locale } = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function review(id: string, status: 'UNDER_REVIEW' | 'RESOLVED') {
    setError(undefined);

    startTransition(async () => {
      const result = await reviewFeedbackAction(id, status);
      if (!result.ok) setError(result.message);
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>{t('feedback.queueEmpty')}</p>
      </Card>
    );
  }

  return (
    <>
      {error ? (
        <p className="ui-field__error" role="alert">
          {error}
        </p>
      ) : null}

      <ul
        aria-label={t('feedback.queueLabel')}
        style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}
      >
        {items.map((item) => (
          <li key={item.id}>
            <Card>
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--ui-space-2)',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Badge tone="neutral">
                  {item.kind === 'COMPLAINT' ? t('feedback.complaint') : t('feedback.suggestion')}
                </Badge>
                <Badge tone={STATUS_TONE[item.status]}>
                  {t(STATUS_LABEL[item.status] as MessageKey)}
                </Badge>
                <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                  {item.authorName ?? t('feedback.memberFallback')} ·{' '}
                  {formatShortDate(item.createdAt, locale)}
                </span>
              </div>

              <p
                style={{ margin: 'var(--ui-space-2) 0 var(--ui-space-3)', whiteSpace: 'pre-wrap' }}
              >
                {item.body}
              </p>

              {canReview && item.status !== 'RESOLVED' ? (
                <div style={{ display: 'flex', gap: 'var(--ui-space-3)' }}>
                  {item.status === 'OPEN' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={pending}
                      onClick={() => {
                        review(item.id, 'UNDER_REVIEW');
                      }}
                    >
                      {t('feedback.markUnderReview')}
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    loading={pending}
                    onClick={() => {
                      review(item.id, 'RESOLVED');
                    }}
                  >
                    {t('feedback.markResolved')}
                  </Button>
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
