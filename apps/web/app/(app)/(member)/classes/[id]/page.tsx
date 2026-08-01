/**
 * A class feed (FR-ACAD-002) — what a student or parent opens the product for.
 *
 * Nothing here decides access. The API refuses `/classes/:id/academics` unless the caller is a
 * verified member of that class, and this page renders whatever comes back or says why it did not.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { PublishItemForm } from '@/components/publish-item-form';
import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type {
  AcademicItemResponse,
  MyMembershipResponse,
  Paginated,
  SubjectResponse,
} from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Class · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function ClassFeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const { id } = await params;
  const { after } = await searchParams;

  // The cursor is opaque and comes straight back from the API; it is only ever passed through.
  const query = after ? `?after=${encodeURIComponent(after)}` : '';

  let feed: Paginated<AcademicItemResponse>;
  let memberships: MyMembershipResponse[];
  let subjects: SubjectResponse[] = [];

  try {
    memberships = (await readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships')).data;
    feed = await readAsUser<Paginated<AcademicItemResponse>>(`/classes/${id}/academics${query}`);

    // A UX gate only: the API rejects publishing unless this teacher is allocated to the subject
    // in this class, which is a stricter test than "has a teacher membership somewhere".
    if (memberships.some((membership) => membership.role === 'TEACHER')) {
      subjects = (await readAsUser<{ data: SubjectResponse[] }>(`/classes/${id}/subjects`)).data;
    }
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect(`/api/auth/refresh?next=/classes/${id}`);

    // The API answers "not a member" and "no such class" the same way on purpose. Rendering its
    // 404 as our 404 keeps that property instead of leaking existence through a nicer message.
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();

    throw error;
  }

  const membership = memberships.find((entry) => entry.classId === id);

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href="/home">← Your classes</Link>
      </p>

      <PageHeader
        title={membership?.className ?? 'Class'}
        {...(membership?.schoolName ? { description: membership.schoolName } : {})}
        actions={<Link href={`/classes/${id}/timetable`}>Timetable</Link>}
      />

      {subjects.length > 0 ? (
        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Publish to this class</h2>
          <PublishItemForm classId={id} subjects={subjects} />
        </Card>
      ) : null}

      <section style={{ marginTop: 'var(--ui-space-5)' }}>
        <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>Recent</h2>

        {feed.data.length === 0 ? (
          <Card>
            <p style={{ margin: 0 }}>
              {after ? 'Nothing older to show.' : 'Nothing has been published to this class yet.'}
            </p>
          </Card>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
            {feed.data.map((item) => (
              <li key={item.id}>
                <Card>
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--ui-space-2)',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Badge tone="neutral">{item.type}</Badge>
                    {/* Unread is stated in words, not only by weight or colour. */}
                    {item.read ? null : <Badge tone="info">Unread</Badge>}
                    {item.readCount === undefined ? null : (
                      <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                        Read by {item.readCount}
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: 'var(--ui-space-2) 0 0', fontSize: 'var(--ui-text-base)' }}>
                    <Link href={`/academics/${item.id}`}>{item.title}</Link>
                  </h3>

                  <p
                    className="muted"
                    style={{ margin: '0.25rem 0 0', fontSize: 'var(--ui-text-sm)' }}
                  >
                    {item.subjectName ?? 'Subject'} · {item.authorName ?? 'Staff'}
                    {item.dueAt ? ` · due ${new Date(item.dueAt).toLocaleDateString('en-GB')}` : ''}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {feed.nextCursor ? (
          <p style={{ marginTop: 'var(--ui-space-4)' }}>
            <Link href={`/classes/${id}?after=${encodeURIComponent(feed.nextCursor)}`}>
              Older items
            </Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
