/**
 * School portal shell.
 *
 * Guards the whole section on account type. This is a **UX guard**, exactly like the middleware —
 * it stops an individual seeing a portal full of controls that would all fail. The API refuses
 * every one of these operations independently, which is where the actual security lives.
 */
import { redirect } from 'next/navigation';

import { SchoolNav } from '@/components/school-nav';
import { readAccessToken, readRefreshToken } from '@/lib/session';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse } from '@connected/types';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default async function SchoolLayout({ children }: { children: ReactNode }) {
  if (!(await readAccessToken())) {
    redirect((await readRefreshToken()) ? '/api/auth/refresh?next=/school' : '/login');
  }

  let account: CurrentAccountResponse;
  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/school');
    throw error;
  }

  // An individual has no business here; send them to their own home rather than a wall of 403s.
  if (account.accountType !== 'SCHOOL') {
    redirect('/home');
  }

  return (
    <main>
      <SchoolNav schoolName={account.schoolName ?? 'Your school'} />
      {children}
    </main>
  );
}
