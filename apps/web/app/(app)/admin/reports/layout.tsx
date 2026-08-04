/**
 * The moderation console shell (ADR-0017).
 *
 * A **UX guard**, exactly like the school portal's: it stops someone who is not staff seeing a
 * console full of controls that would all 404. The API re-reads `is_platform_admin` on every
 * moderation call, which is where the actual security lives — and it returns 404 rather than 403,
 * so this redirect is also what stops an ordinary account confirming the console exists.
 */
import { redirect } from 'next/navigation';

import { readAccessToken, readRefreshToken } from '@/lib/session';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse } from '@connected/types';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default async function ModerationLayout({ children }: { children: ReactNode }) {
  if (!(await readAccessToken())) {
    redirect((await readRefreshToken()) ? '/api/auth/refresh?next=/admin/reports' : '/login');
  }

  let account: CurrentAccountResponse;
  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/admin/reports');
    throw error;
  }

  if (!account.isPlatformAdmin) {
    redirect('/home');
  }

  return <main>{children}</main>;
}
