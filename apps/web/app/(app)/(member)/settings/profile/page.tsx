/**
 * Your own profile, and the settings on it (FR-SOC-001).
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ProfileForm } from '@/components/profile-form';
import { ApiError } from '@/lib/api-client';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse, ProfileResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your profile · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  let profile: ProfileResponse;
  let account: CurrentAccountResponse;

  try {
    [profile, account] = await Promise.all([
      readAsUser<ProfileResponse>('/me/profile'),
      readAsUser<CurrentAccountResponse>('/me'),
    ]);
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/settings/profile');
    if (error instanceof ApiError && error.status === 404) redirect('/home');
    throw error;
  }

  // A school edits itself in the portal, which knows about addresses and affiliation.
  if (account.accountType === 'SCHOOL') redirect('/school');

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href={`/accounts/${account.id}`}>← How others see you</Link>
      </p>

      <PageHeader title="Your profile" />

      <Card as="section">
        <ProfileForm profile={profile} />
      </Card>
    </main>
  );
}
