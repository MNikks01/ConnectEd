'use client';

/**
 * Raising a complaint or a suggestion, and the school's side of reviewing them.
 */
import { Badge, Button, Card, Field } from '@connected/ui';
import { useState, useTransition } from 'react';

import { submitFeedbackAction } from '@/app/(app)/(member)/actions';
import { reviewFeedbackAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';

import type { FeedbackResponse } from '@connected/types';

const STATUS_TONE = {
  OPEN: 'info',
  UNDER_REVIEW: 'warning',
  RESOLVED: 'success',
} as const;

const STATUS_LABEL = {
  OPEN: 'Not yet read',
  UNDER_REVIEW: 'Being looked at',
  RESOLVED: 'Resolved',
} as const;

export function FeedbackForm({ schoolId }: { schoolId: string }) {
  return (
    <ActionForm
      action={submitFeedbackAction.bind(null, schoolId)}
      submitLabel="Send to the school"
      pendingLabel="Sending…"
      successMessage="Sent. The school can see who raised it."
      resetOnSuccess
    >
      <Field
        name="kind"
        label="Type"
        as="select"
        required
        error={useFieldError('kind')}
        options={[
          { value: 'COMPLAINT', label: 'Complaint' },
          { value: 'SUGGESTION', label: 'Suggestion' },
        ]}
      />
      <Field
        name="body"
        label="Details"
        as="textarea"
        rows={5}
        required
        maxLength={5000}
        error={useFieldError('body')}
        hint="Your name is attached — this is not anonymous."
      />
    </ActionForm>
  );
}

/** What the author sees: status, no controls. */
export function FeedbackHistory({ items }: { items: FeedbackResponse[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>You have not raised anything yet.</p>
      </Card>
    );
  }

  return (
    <ul
      aria-label="What you have raised"
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
              <Badge tone="neutral">{item.kind === 'COMPLAINT' ? 'Complaint' : 'Suggestion'}</Badge>
              <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
              <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                {new Date(item.createdAt).toLocaleDateString('en-GB')}
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
        <p style={{ margin: 0 }}>Nothing here. Complaints and suggestions arrive in this list.</p>
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
        aria-label="Complaints and suggestions"
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
                  {item.kind === 'COMPLAINT' ? 'Complaint' : 'Suggestion'}
                </Badge>
                <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                  {item.authorName ?? 'A member'} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString('en-GB')}
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
                      Mark as being looked at
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    loading={pending}
                    onClick={() => {
                      review(item.id, 'RESOLVED');
                    }}
                  >
                    Mark resolved
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
