/**
 * The inbox (FR-SOC-020, 021).
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LiveMessages } from '@/components/live-messages';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { InboxResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('messages.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const { t } = await getTranslations();

  let inbox: InboxResponse;

  try {
    inbox = await readAsUser<InboxResponse>('/threads');
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/messages');
    throw error;
  }

  return (
    <main>
      <LiveMessages />
      <PageHeader
        title={t('messages.title')}
        description={
          inbox.unreadTotal > 0
            ? t('messages.unreadCount', { count: inbox.unreadTotal })
            : t('messages.nothingUnread')
        }
      />

      {inbox.data.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{t('messages.empty')}</p>
        </Card>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
          {inbox.data.map((thread) => (
            <li key={thread.id}>
              <Card>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--ui-space-2)',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <Link href={`/messages/${thread.id}`}>{thread.other.displayName}</Link>
                  {thread.unreadCount > 0 ? (
                    <Badge tone="info">
                      {t('messages.unreadCount', { count: thread.unreadCount })}
                    </Badge>
                  ) : null}
                </div>

                <p
                  className="muted"
                  style={{ margin: '0.25rem 0 0', fontSize: 'var(--ui-text-sm)' }}
                >
                  {thread.lastMessage
                    ? `${thread.lastMessage.mine ? t('messages.youPrefix') : ''}${thread.lastMessage.body}`
                    : t('messages.noMessagesYet')}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
