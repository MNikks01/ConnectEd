/**
 * The notification list (FR-NOTIF-002).
 *
 * Every row is scoped to the caller by the API's query rather than by an id it is asked to check,
 * so there is no path here that could read someone else's.
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { NotificationList } from '@/components/notification-list';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { NotificationListResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Notifications · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string }>;
}) {
  const { after } = await searchParams;

  let list: NotificationListResponse;
  try {
    list = await readAsUser<NotificationListResponse>(
      `/notifications${after ? `?cursor=${encodeURIComponent(after)}` : ''}`,
    );
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/notifications');
    throw error;
  }

  return (
    <main>
      <PageHeader
        title="Notifications"
        description={
          list.unreadCount > 0 ? `${list.unreadCount} unread` : 'Everything here has been read.'
        }
      />

      {list.data.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            Nothing yet. Homework, decisions on your verification, and school announcements arrive
            here.
          </p>
        </Card>
      ) : (
        <NotificationList
          notifications={list.data}
          unreadCount={list.unreadCount}
          nextCursor={list.nextCursor}
        />
      )}
    </main>
  );
}
