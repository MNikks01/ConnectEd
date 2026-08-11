/**
 * The notification list (FR-NOTIF-002).
 *
 * Every row is scoped to the caller by the API's query rather than by an id it is asked to check,
 * so there is no path here that could read someone else's.
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { NotificationList } from '@/components/notification-list';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { NotificationListResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('notifications.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string }>;
}) {
  const { after } = await searchParams;
  const { t } = await getTranslations();

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
        title={t('notifications.title')}
        description={
          list.unreadCount > 0
            ? t('notifications.unreadCount', { count: list.unreadCount })
            : t('notifications.allRead')
        }
      />

      {list.data.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{t('notifications.empty')}</p>
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
