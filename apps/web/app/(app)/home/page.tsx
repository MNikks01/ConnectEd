/**
 * The authenticated shell. A Server Component: it calls the API during SSR using the access token
 * from the httpOnly cookie, so the token never reaches the browser.
 *
 * Role dashboards, the school portal, and social land on top of this in Sprint 1.
 */
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
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1>Signed in</h1>
          <p className="muted">
            {account.accountType === 'SCHOOL'
              ? 'You are signed in as an institution.'
              : 'You are signed in as an individual.'}
          </p>
        </div>
        <div style={{ width: 'auto' }}>
          <LogoutButton />
        </div>
      </header>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Your account</h2>
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
          <dd>{account.emailVerified ? 'Yes' : 'Not yet'}</dd>
        </dl>
      </div>

      <p className="muted" style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
        This page is the authenticated skeleton — it proves the browser, this app, and the API share
        a working session. Role dashboards and the school portal arrive in Sprint 1.
      </p>
    </main>
  );
}
