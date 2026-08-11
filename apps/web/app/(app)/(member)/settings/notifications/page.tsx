/**
 * Notification preferences (FR-NOTIF-006).
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { NotificationPrefsForm } from '@/components/notification-prefs-form';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { NotificationPrefResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('notificationPrefs.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function NotificationPrefsPage() {
  const { t } = await getTranslations();

  let preferences: NotificationPrefResponse[];

  try {
    const response = await readAsUser<{ data: NotificationPrefResponse[] }>(
      '/me/notification-prefs',
    );
    preferences = response.data;
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect('/api/auth/refresh?next=/settings/notifications');
    }
    throw error;
  }

  return (
    <>
      <PageHeader
        title={t('notificationPrefs.title')}
        description={t('notificationPrefs.description')}
      />

      <Card as="section">
        <NotificationPrefsForm preferences={preferences} />
      </Card>
    </>
  );
}
