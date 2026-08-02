'use client';

/**
 * A conversation, and the box to add to it.
 *
 * Messages arrive newest-first from the API because that is what pagination needs; a conversation
 * reads oldest-first, so the order is reversed here rather than asking the API for a second sort.
 */
import { Card, Field } from '@connected/ui';

import { sendMessageAction } from '@/app/(app)/(member)/actions';
import { ActionForm, useFieldError } from './action-form';

import type { MessageResponse } from '@connected/types';

function BodyField() {
  return (
    <Field
      name="body"
      label="Message"
      as="textarea"
      rows={2}
      required
      maxLength={5000}
      error={useFieldError('body')}
    />
  );
}

export function MessageThread({
  threadId,
  messages,
}: {
  threadId: string;
  messages: MessageResponse[];
}) {
  const inOrder = [...messages].reverse();

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      {inOrder.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>Nothing said yet. Start the conversation below.</p>
        </Card>
      ) : (
        <ul
          aria-label="Messages"
          style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-2)' }}
        >
          {inOrder.map((message) => (
            <li key={message.id}>
              <Card>
                <p className="muted" style={{ margin: 0, fontSize: 'var(--ui-text-sm)' }}>
                  {/* Said in words, not by which side of the screen it sits on. */}
                  {message.mine ? 'You' : 'Them'} ·{' '}
                  {new Date(message.createdAt).toLocaleString('en-GB')}
                  {message.mine && message.readAt ? ' · read' : ''}
                </p>
                <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{message.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ActionForm
        action={sendMessageAction.bind(null, threadId)}
        submitLabel="Send"
        pendingLabel="Sending…"
        successMessage="Sent."
        resetOnSuccess
      >
        <BodyField />
      </ActionForm>
    </div>
  );
}
