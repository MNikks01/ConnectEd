/**
 * One notice. Opening it is what marks it read (FR-ACAD-010).
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { NoticeResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Notice · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let notice: NoticeResponse;
  try {
    notice = await readAsUser<NoticeResponse>(`/notices/${id}`);
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect(`/api/auth/refresh?next=/notices/${id}`);
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href="/notices">← All notices</Link>
      </p>

      <PageHeader
        title={notice.title}
        description={`${notice.authorName ?? 'School'} · ${new Date(
          notice.createdAt,
        ).toLocaleDateString('en-GB')}`}
      />

      <Card as="article">
        {/* Plain text the school typed — rendered as text, not markup. */}
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{notice.body}</p>
      </Card>

      {notice.readCount === undefined ? null : (
        <p
          className="muted"
          style={{ marginTop: 'var(--ui-space-4)', fontSize: 'var(--ui-text-sm)' }}
        >
          Read by {notice.readCount}
        </p>
      )}
    </main>
  );
}
