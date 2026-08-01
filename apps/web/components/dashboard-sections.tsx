/**
 * The pieces a role dashboard is assembled from (S2-11).
 *
 * Server Components, deliberately: every one of these renders data the API already authorized, and
 * none of them needs interactivity. They are separated from the page so a role's dashboard is a
 * short list of sections rather than three hundred lines of conditionals.
 */
import { Badge, Card } from '@connected/ui';
import Link from 'next/link';

import type {
  AcademicItemResponse,
  MyTeachingSubjectResponse,
  NoticeResponse,
} from '@connected/types';

/** An item plus the class it came from — the feed endpoint is per class, the dashboard is not. */
export interface DashboardItem extends AcademicItemResponse {
  className: string;
}

function formatDue(dueAt: string): string {
  const due = new Date(dueAt);
  const days = Math.ceil((due.getTime() - Date.now()) / (24 * 3600_000));

  // "in 3 days" beats a date a parent has to count on their fingers, but only near the deadline.
  if (days <= 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  if (days <= 7) return `due in ${days} days`;

  return `due ${due.toLocaleDateString('en-GB')}`;
}

export function DueSoon({ items }: { items: DashboardItem[] }) {
  return (
    <section>
      <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>Due soon</h2>

      {items.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>Nothing with a deadline in the next week.</p>
        </Card>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
          {items.map((item) => (
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
                  <Badge tone="warning">{formatDue(item.dueAt ?? '')}</Badge>
                  {item.read ? null : <Badge tone="info">Unread</Badge>}
                </div>

                <h3 style={{ margin: 'var(--ui-space-2) 0 0', fontSize: 'var(--ui-text-base)' }}>
                  <Link href={`/academics/${item.id}`}>{item.title}</Link>
                </h3>

                <p
                  className="muted"
                  style={{ margin: '0.25rem 0 0', fontSize: 'var(--ui-text-sm)' }}
                >
                  {item.className} · {item.subjectName ?? 'Subject'}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function UnreadWork({ items }: { items: DashboardItem[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>Not read yet</h2>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-2)' }}>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/academics/${item.id}`}>{item.title}</Link>
            <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
              {' '}
              — {item.className}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What a teacher opens the product to do: reach the class they are about to publish to. */
export function TeachingSubjects({ subjects }: { subjects: MyTeachingSubjectResponse[] }) {
  return (
    <section>
      <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>What you teach</h2>

      {/* Defensive: a teacher request must name at least one subject (FR-VER-003), so a verified
          teacher normally has an allocation. This renders if one is later removed — a deleted
          subject cascades its allocations away — rather than showing an empty heading. */}
      {subjects.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            Your school has not allocated you to a subject yet. Until it does, you can read your
            classes but not publish to them.
          </p>
        </Card>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
          {subjects.map((subject) => (
            <li key={subject.subjectId}>
              <Card>
                <h3 style={{ margin: 0, fontSize: 'var(--ui-text-base)' }}>
                  <Link href={`/classes/${subject.classId}`}>
                    {subject.subjectName} · {subject.className}
                  </Link>
                </h3>

                <p
                  className="muted"
                  style={{ margin: '0.25rem 0 0', fontSize: 'var(--ui-text-sm)' }}
                >
                  {subject.schoolName ?? 'School'} ·{' '}
                  <Link href={`/classes/${subject.classId}/syllabus`}>Syllabus coverage</Link>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecentNotices({ notices }: { notices: NoticeResponse[] }) {
  if (notices.length === 0) return null;

  return (
    <section>
      <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>From your school</h2>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-2)' }}>
        {notices.map((notice) => (
          <li key={notice.id}>
            {notice.read ? null : (
              <>
                <Badge tone="info">Unread</Badge>{' '}
              </>
            )}
            <Link href={`/notices/${notice.id}`}>{notice.title}</Link>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 'var(--ui-space-3)' }}>
        <Link href="/notices">All notices</Link>
      </p>
    </section>
  );
}
