/**
 * One conversation. Opening this page is what marks its messages read (FR-SOC-021).
 */
import { PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { MessageThread } from '@/components/message-thread';
import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { InboxResponse, MessageResponse, Paginated } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Conversation · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let messages: Paginated<MessageResponse>;
  let inbox: InboxResponse;

  try {
    // The read is what clears the unread count, so it happens before the inbox is fetched for the
    // heading — otherwise the page would show a badge it has just cleared.
    messages = await readAsUser<Paginated<MessageResponse>>(`/threads/${id}/messages`);
    inbox = await readAsUser<InboxResponse>('/threads');
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect(`/api/auth/refresh?next=/messages/${id}`);
    // 404 covers "not yours" and "blocked" alike, which is the API's intent.
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const thread = inbox.data.find((row) => row.id === id);

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href="/messages">← All messages</Link>
      </p>

      <PageHeader title={thread?.other.displayName ?? 'Conversation'} />

      <MessageThread threadId={id} messages={messages.data} />
    </main>
  );
}
