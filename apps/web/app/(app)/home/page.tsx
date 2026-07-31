/**
 * The authenticated shell. A Server Component: it calls the API during SSR using the access token
 * from the httpOnly cookie, so the token never reaches the browser.
 *
 * Role dashboards, the school portal, and social land on top of this next.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { LogoutButton } from '@/components/logout-button';
import { ApiError, getCurrentAccount } from '@/lib/api-client';
import { readAccessToken, readRefreshToken } from '@/lib/session';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Home · GetConnected' };

// Personalized and session-dependent — never prerendered or cached.
export const dynamic = 'force-dynamic';

export default async function AppHomePage() {
  const accessToken = await readAccessToken();

  // The access cookie outlives its token by design; when it lapses, the refresh route mints a new
  // one and returns here. Server Components cannot set cookies, which is why this is a redirect.
  if (!accessToken) {
    redirect((await readRefreshToken()) ? '/api/auth/refresh?next=/home' : '/login');
  }

  let account;
  try {
    account = await getCurrentAccount(accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.isAuthFailure) {
      redirect('/api/auth/refresh?next=/home');
    }
    throw error;
  }

  return (
    <main>
      <PageHeader
        title="Signed in"
        description={
          account.accountType === 'SCHOOL'
            ? 'You are signed in as an institution.'
            : 'You are signed in as an individual.'
        }
        actions={<LogoutButton />}
      />

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Your account</h2>

        <dl className="summary">
          <dt>Name</dt>
          <dd>{account.fullName ?? account.schoolName ?? '—'}</dd>

          <dt>Email</dt>
          <dd>{account.email}</dd>

          <dt>Account type</dt>
          <dd>{account.accountType}</dd>

          <dt>Role</dt>
          <dd>{account.role ?? 'Not applicable'}</dd>

          <dt>Handle</dt>
          <dd>{account.handle ?? '—'}</dd>

          <dt>Email verified</dt>
          <dd>
            <Badge tone={account.emailVerified ? 'success' : 'warning'}>
              {account.emailVerified ? 'Verified' : 'Not yet verified'}
            </Badge>
          </dd>
        </dl>
      </Card>

      <p
        className="muted"
        style={{ marginTop: 'var(--ui-space-5)', fontSize: 'var(--ui-text-sm)' }}
      >
        This page is the authenticated skeleton — it proves the browser, this app, and the API share
        a working session. Role dashboards and the school portal arrive next.
      </p>
    </main>
  );
}
