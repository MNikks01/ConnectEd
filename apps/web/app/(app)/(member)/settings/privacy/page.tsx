/**
 * Your data — export and erasure (`.docs/PRD/14-export-and-erasure.md`).
 *
 * One page for both rights, deliberately. They are the two halves of the same question — "what do
 * you have about me, and will you stop having it" — and splitting them across two screens would
 * mean somebody looking for the second finds only the first and concludes the answer is no.
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { PrivacyPanel } from '@/components/privacy-panel';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { DataExportResponse, PrivacyStatusResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your data · GetConnected' };
export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  let status: PrivacyStatusResponse;
  let exports: DataExportResponse[];

  try {
    const [statusResponse, listResponse] = await Promise.all([
      readAsUser<PrivacyStatusResponse>('/me/privacy'),
      readAsUser<{ data: DataExportResponse[] }>('/me/exports'),
    ]);

    status = statusResponse;
    exports = listResponse.data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/settings/privacy');
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Your data"
        description="A copy of everything we hold about you, and the way to have it deleted."
      />

      <PrivacyPanel status={status} exports={exports} />

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>What we cannot undo</h2>
        <p>
          {/* Said here rather than left to a privacy notice nobody opens. The product should
              describe what it can actually do — implying more is the failure worth avoiding. */}
          Deleting your account does not reach a backup taken before it ran, a copy of your data you
          have already downloaded, or a report somebody else has raised about you. Marks, registers
          and report cards stay with your school: they are its records as much as yours, and in most
          places it is required to keep them.
        </p>
        <p style={{ marginBottom: 0 }}>
          What goes is <strong>you</strong> — your profile, your handle, your posts and comments,
          your messages, and your sign-in. Anything the school keeps afterwards shows{' '}
          <em>“A former member”</em> where your name used to be.
        </p>
      </Card>
    </>
  );
}
