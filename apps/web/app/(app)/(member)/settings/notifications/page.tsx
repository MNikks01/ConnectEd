/**
 * Notification preferences (FR-NOTIF-006).
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { NotificationPrefsForm } from '@/components/notification-prefs-form';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { NotificationPrefResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Notifications · GetConnected' };
export const dynamic = 'force-dynamic';

export default async function NotificationPrefsPage() {
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
        title="Notifications"
        description="What you want to hear about. Switching something off stops it appearing in your list at all."
      />

      <Card as="section">
        <NotificationPrefsForm preferences={preferences} />
      </Card>
    </>
  );
}
