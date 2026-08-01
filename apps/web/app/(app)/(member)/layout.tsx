/**
 * The member shell — everything a person (rather than an institution) sees.
 *
 * The unread count is fetched here rather than in the bell itself so it is server-rendered with
 * the page: a badge that appears a moment after the rest of the header is a layout shift on every
 * navigation, and the number is already one cheap query away from the session we just proved.
 *
 * Schools are *not* redirected away. A school legitimately reads its own classes' feeds, and its
 * notifications (verification requests) arrive through the same list.
 */
import { redirect } from 'next/navigation';

import { MemberNav } from '@/components/member-nav';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';
import { readAccessToken, readRefreshToken } from '@/lib/session';

import type { CurrentAccountResponse, NotificationListResponse } from '@connected/types';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default async function MemberLayout({ children }: { children: ReactNode }) {
  if (!(await readAccessToken())) {
    redirect((await readRefreshToken()) ? '/api/auth/refresh?next=/home' : '/login');
  }

  let account: CurrentAccountResponse;
  let unreadCount = 0;

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
    // `limit=1` because only the count is wanted; the list itself lives on its own page.
    unreadCount = (
      await readAsUser<NotificationListResponse>('/notifications?unreadOnly=true&limit=1')
    ).unreadCount;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/home');
    throw error;
  }

  return (
    <div className="member-shell">
      <MemberNav
        name={account.fullName ?? account.schoolName ?? account.email}
        unreadCount={unreadCount}
      />
      {children}
    </div>
  );
}
