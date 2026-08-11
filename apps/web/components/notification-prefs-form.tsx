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
import { useTranslations } from '@/components/locale-provider';

import type { MessageKey } from '@/lib/i18n/translate';
import type { NotificationPrefResponse } from '@connected/types';

const LABELS: Record<string, MessageKey> = {
  ACADEMIC: 'notificationPrefs.academic',
  NOTICE: 'notificationPrefs.notice',
  EVENT: 'notificationPrefs.event',
  LEAVE: 'notificationPrefs.leaveCategory',
  SOCIAL: 'notificationPrefs.socialCategory',
  MESSAGE: 'notificationPrefs.message',
};

export function NotificationPrefsForm({
  preferences,
}: {
  preferences: NotificationPrefResponse[];
}) {
  const { t } = useTranslations();
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
              <span>
                {/* The category falls back to its own code rather than to English: an untranslated
                    key is a bug to notice, and "MESSAGE" is at least unambiguous about being one. */}
                {preference.category in LABELS
                  ? t(LABELS[preference.category] as MessageKey)
                  : preference.category}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {/* Said plainly. An absence with no explanation reads as a bug. */}
      <p className="muted">{t('notificationPrefs.alwaysTold')}</p>

      <Button
        loading={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const result = await updateNotificationPrefsAction(current);
            if (result.ok) setMessage(t('notificationPrefs.saved'));
            else setError(result.message);
          });
        }}
      >
        {t('notificationPrefs.save')}
      </Button>
    </div>
  );
}
