/**
 * The class timetable as a member sees it (FR-ACAD-020, FR-ACAD-021).
 *
 * Its own page rather than a panel on the feed: a timetable is looked up deliberately, and an
 * image the size of a wall chart would push the day's homework below the fold.
 *
 * Two shapes reach this page — a photograph of the sheet on the wall, or a structured week — and
 * which one arrives is the school's choice, version by version. The page renders whichever it got
 * and never asks the reader to care.
 */
import { Card, PageHeader } from '@connected/ui';

import { TimetableGrid } from '@/components/timetable-grid';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { TimetableResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Timetable · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function TimetablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let timetable: TimetableResponse | undefined;

  try {
    timetable = await readAsUser<TimetableResponse>(`/classes/${id}/timetable`);
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect(`/api/auth/refresh?next=/classes/${id}/timetable`);
    }

    // 403 is "not your class" — the same answer the feed gives, for the same reason.
    if (error instanceof ApiError && error.status === 403) notFound();

    // 404 is "no timetable yet", which is a normal state with its own message below.
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href={`/classes/${id}`}>← Back to the class</Link>
      </p>

      <PageHeader
        title="Timetable"
        {...(timetable ? { description: `Version ${timetable.version}` } : {})}
      />

      {timetable?.kind === 'STRUCTURED' ? (
        <TimetableGrid periods={timetable.periods} />
      ) : timetable?.imageUrl ? (
        <figure style={{ margin: 0 }}>
          {/* A signed URL that expires — `next/image` would proxy and cache it. */}
          <img
            src={timetable.imageUrl}
            alt={`Class timetable, version ${timetable.version}`}
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--ui-radius)' }}
          />
          <figcaption
            className="muted"
            style={{ fontSize: 'var(--ui-text-sm)', marginTop: 'var(--ui-space-2)' }}
          >
            Uploaded {new Date(timetable.createdAt).toLocaleDateString('en-GB')}
          </figcaption>
        </figure>
      ) : (
        <Card>
          <p style={{ margin: 0 }}>Your school has not uploaded a timetable for this class yet.</p>
        </Card>
      )}
    </main>
  );
}
