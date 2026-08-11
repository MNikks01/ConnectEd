/**
 * One academic item (FR-ACAD-003).
 *
 * Opening this page is what marks the item read — the API records the receipt as a side effect of
 * the authorized read, so there is no "mark as read" button to forget to press and no client-side
 * claim about who has seen what.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ApiError } from '@/lib/api-client';
import { formatDateTime, formatShortDate } from '@/lib/i18n/format';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { AcademicItemResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('academicItem.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function AcademicItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getTranslations();

  let item: AcademicItemResponse;
  try {
    item = await readAsUser<AcademicItemResponse>(`/academics/${id}`);
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect(`/api/auth/refresh?next=/academics/${id}`);
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href={`/classes/${item.classId}`}>{t('academicItem.backToClass')}</Link>
      </p>

      <PageHeader
        title={item.title}
        description={t('academicItem.byline', {
          subject: item.subjectName ?? t('academicItem.subjectFallback'),
          author: item.authorName ?? t('academicItem.staffFallback'),
        })}
      />

      <div
        style={{
          display: 'flex',
          gap: 'var(--ui-space-2)',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 'var(--ui-space-4)',
        }}
      >
        <Badge tone="neutral">{item.type}</Badge>
        {item.dueAt ? (
          <Badge tone="warning">
            {t('academicItem.due', { date: formatShortDate(item.dueAt, locale) })}
          </Badge>
        ) : null}
        {item.readCount === undefined ? null : (
          <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
            {t('academicItem.readBy', { count: item.readCount })}
          </span>
        )}
      </div>

      <Card as="article">
        {/* `white-space: pre-wrap` rather than a markdown renderer: the body is plain text the
            teacher typed, and rendering it as markup would be an injection surface for no gain. */}
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.body}</p>

        {item.imageUrl ? (
          <p style={{ margin: 'var(--ui-space-4) 0 0' }}>
            {/* A signed URL the API issued *after* authorizing this read, valid for minutes.
                Plain <img>: `next/image` would proxy and cache a URL that is meant to expire. */}
            <img
              src={item.imageUrl}
              alt={t('academicItem.attachmentAlt', { title: item.title })}
              style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--ui-radius)' }}
            />
          </p>
        ) : null}
      </Card>

      <p
        className="muted"
        style={{ marginTop: 'var(--ui-space-4)', fontSize: 'var(--ui-text-sm)' }}
      >
        {t('academicItem.published', { date: formatDateTime(item.createdAt, locale) })}
      </p>
    </main>
  );
}
