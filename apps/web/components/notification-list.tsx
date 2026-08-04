'use client';

/**
 * Rendered notifications.
 *
 * Each `type` gets its own sentence rather than a generic "you have a notification": the payload
 * shapes differ per event, and a renderer that guessed at fields would print `undefined` to a
 * parent. An unrecognised type still renders — as its own line, not as a crash — because the API
 * may ship a new event before the portal knows about it.
 */
import { academicPublishedPayload, type NotificationResponse } from '@connected/types';
import { Badge, Button, Card } from '@connected/ui';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { markAllNotificationsReadAction } from '@/app/(app)/(member)/actions';

interface Rendered {
  text: string;
  href?: string;
}

function render(notification: NotificationResponse): Rendered {
  switch (notification.type) {
    case 'academic.published': {
      const payload = academicPublishedPayload(notification.payload);
      if (!payload) return { text: 'New work was published to your class.' };

      return {
        text: `New ${payload.itemType.toLowerCase()}: ${payload.title}`,
        href: `/academics/${payload.itemId}`,
      };
    }

    case 'verification.submitted':
      return { text: 'Someone asked to join your school.', href: '/school/verifications' };

    case 'verification.decided':
      return { text: 'Your school decided on your request to join.', href: '/home' };

    case 'membership.revoked':
      return { text: 'A school ended your membership.', href: '/home' };

    default:
      return { text: notification.type };
  }
}

export function NotificationList({
  notifications,
  unreadCount,
  nextCursor,
}: {
  notifications: NotificationResponse[];
  unreadCount: number;
  nextCursor: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  return (
    <div>
      {error ? (
        <p className="ui-field__error" role="alert">
          {error}
        </p>
      ) : null}

      {unreadCount > 0 ? (
        <p style={{ marginTop: 0 }}>
          <Button
            variant="secondary"
            loading={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await markAllNotificationsReadAction();
                // Low stakes next to a withdrawal, and still not nothing: a badge that stays lit
                // after you pressed the button reads as a broken page.
                if (!result.ok) setError(result.message);
              });
            }}
          >
            {pending ? 'Marking…' : 'Mark all as read'}
          </Button>
        </p>
      ) : null}

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
        {notifications.map((notification) => {
          const { text, href } = render(notification);

          return (
            <li key={notification.id}>
              <Card>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--ui-space-2)',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Unread is a word, not only a colour or a dot. */}
                  {notification.read ? null : <Badge tone="info">Unread</Badge>}
                  <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                    {new Date(notification.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>

                <p style={{ margin: 'var(--ui-space-2) 0 0' }}>
                  {href ? <Link href={href}>{text}</Link> : text}
                </p>
              </Card>
            </li>
          );
        })}
      </ul>

      {nextCursor ? (
        <p style={{ marginTop: 'var(--ui-space-4)' }}>
          <Link href={`/notifications?after=${encodeURIComponent(nextCursor)}`}>Older</Link>
        </p>
      ) : null}
    </div>
  );
}
