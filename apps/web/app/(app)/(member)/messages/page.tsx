/**
 * The inbox (FR-SOC-020, 021).
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { InboxResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Messages · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  let inbox: InboxResponse;

  try {
    inbox = await readAsUser<InboxResponse>('/threads');
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/messages');
    throw error;
  }

  return (
    <main>
      <PageHeader
        title="Messages"
        description={inbox.unreadTotal > 0 ? `${inbox.unreadTotal} unread` : 'Nothing unread.'}
      />

      {inbox.data.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            No conversations. Open someone&rsquo;s profile and choose Message to start one.
          </p>
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
                    <Badge tone="info">{thread.unreadCount} unread</Badge>
                  ) : null}
                </div>

                <p
                  className="muted"
                  style={{ margin: '0.25rem 0 0', fontSize: 'var(--ui-text-sm)' }}
                >
                  {thread.lastMessage
                    ? `${thread.lastMessage.mine ? 'You: ' : ''}${thread.lastMessage.body}`
                    : 'No messages yet.'}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
