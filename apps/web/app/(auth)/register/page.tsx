import Link from 'next/link';

import { AuthForm, FormField } from '@/components/auth-form';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create an account · GetConnected' };

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <div className="card auth-card">
        <h1>Create an account</h1>
        <p className="muted">
          You will start as a general member. Academic roles are requested afterwards and confirmed
          by your school.
        </p>

        <AuthForm
          action="/api/auth/register"
          submitLabel="Create account"
          pendingLabel="Creating account…"
          redirectTo="/home"
        >
          <FormField name="fullName" label="Full name" autoComplete="name" required />
          <FormField
            name="handle"
            label="Handle"
            autoComplete="username"
            required
            hint="Lowercase letters, numbers, dots, and underscores."
          />
          <FormField name="email" label="Email" type="email" autoComplete="email" required />
          <FormField
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 12 characters. A memorable phrase beats a short complicated one."
          />
        </AuthForm>

        <p className="muted">
          Already have an account? <Link href="/login">Sign in</Link>.
        </p>
      </div>
    </main>
  );
}
