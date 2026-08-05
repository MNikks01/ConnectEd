'use client';

/**
 * Which notifications a person wants (FR-NOTIF-006).
 *
 * Switches rather than a multi-select: the question is "do you want these", asked once per
 * category, and a list of checkboxes answers it without anybody having to work out what an unticked
 * box in a group means.
 *
 * Verification and billing are absent because they are not switchable. The page says so rather
 * than leaving a reader to wonder whether the list is complete — an absence with no explanation
 * reads as a bug.
 */
import { Button } from '@connected/ui';
import { useState, useTransition } from 'react';

import { updateNotificationPrefsAction } from '@/app/(app)/(member)/actions';

import type { NotificationPrefResponse } from '@connected/types';

const LABELS: Record<string, string> = {
  ACADEMIC: 'Homework, assignments and projects',
  NOTICE: 'School notices',
  EVENT: 'Events',
  LEAVE: 'Leave applications and decisions',
  SOCIAL: 'Follows, connections, likes and comments',
  MESSAGE: 'Direct messages',
};

export function NotificationPrefsForm({
  preferences,
}: {
  preferences: NotificationPrefResponse[];
}) {
  const [current, setCurrent] = useState(preferences);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  function toggle(category: string) {
    setCurrent((rows) =>
      rows.map((row) => (row.category === category ? { ...row, enabled: !row.enabled } : row)),
    );
    // Cleared on any change, so a stale "Saved." cannot sit above unsaved edits.
    setMessage(undefined);
    setError(undefined);
  }

  return (
    <div>
      {error ? (
        <p className="ui-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
        {current.map((preference) => (
          <li key={preference.category}>
            <label style={{ display: 'flex', gap: 'var(--ui-space-2)', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={preference.enabled}
                onChange={() => {
                  toggle(preference.category);
                }}
              />
              <span>{LABELS[preference.category] ?? preference.category}</span>
            </label>
          </li>
        ))}
      </ul>

      <p className="muted">
        {/* Said plainly. An absence with no explanation reads as a bug. */}
        You will always be told about a verification decision and anything to do with your school’s
        subscription — those are answers to things you asked for, not announcements.
      </p>

      <Button
        loading={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const result = await updateNotificationPrefsAction(current);
            if (result.ok) setMessage('Saved.');
            else setError(result.message);
          });
        }}
      >
        Save preferences
      </Button>
    </div>
  );
}
