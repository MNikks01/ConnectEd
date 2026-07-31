import Link from 'next/link';

import { AuthForm, FormField } from '@/components/auth-form';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in · GetConnected' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;

  return (
    <main className="auth-shell">
      <div className="card auth-card">
        <h1>Sign in</h1>
        <p className="muted">Welcome back to GetConnected.</p>

        {expired ? (
          <p className="form-error" role="status">
            Your session expired. Please sign in again.
          </p>
        ) : null}

        <AuthForm
          action="/api/auth/login"
          submitLabel="Sign in"
          pendingLabel="Signing in…"
          redirectTo="/home"
        >
          <FormField name="email" label="Email" type="email" autoComplete="email" required />
          <FormField
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
          />
        </AuthForm>

        <p className="muted">
          No account yet? <Link href="/register">Create one</Link>.
        </p>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          School accounts sign in here on the web. They cannot be used in the mobile app.
        </p>
      </div>
    </main>
  );
}
