'use client';

/**
 * Signing in, in one step or two (FR-AUTH-004, FR-AUTH-012).
 *
 * The second step exists only for accounts that have enrolled, and the form finds out by asking:
 * the password goes first, and the answer is either a session or a request for a code. There is no
 * "do you have 2FA?" lookup before the password, because that would answer the question for
 * somebody who does not know the password.
 *
 * On the second step the email and password fields are gone rather than disabled. A visible
 * password field at the moment somebody is reaching for their phone invites them to retype it and
 * wonder why nothing happens.
 */
import { Button, Field } from '@connected/ui';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type { ErrorEnvelope } from '@connected/types';

export function LoginForm({ redirectTo = '/home' }: { redirectTo?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [challengeToken, setChallengeToken] = useState<string | undefined>();

  async function post(path: string, body: unknown): Promise<Response> {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function messageFrom(response: Response): Promise<string> {
    const body = (await response.json().catch(() => undefined)) as ErrorEnvelope | undefined;
    return body?.error.message ?? 'Something went wrong. Please try again.';
  }

  function done(): void {
    router.push(redirectTo);
    router.refresh();
  }

  async function onPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const form = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const response = await post('/api/auth/login', form);

      if (!response.ok) {
        setError(await messageFrom(response));
        return;
      }

      const body = (await response.json()) as {
        twoFactorRequired?: boolean;
        challengeToken?: string;
      };

      if (body.twoFactorRequired && body.challengeToken) {
        setChallengeToken(body.challengeToken);
        return;
      }

      done();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function onCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const { code } = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const response = await post('/api/auth/login/2fa', { challengeToken, code });

      if (!response.ok) {
        setError(await messageFrom(response));
        // The challenge is spent whether or not the code was right, so there is nothing to retry
        // with. Back to the password rather than leaving somebody typing codes at a dead token.
        setChallengeToken(undefined);
        return;
      }

      done();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (challengeToken) {
    return (
      <form
        onSubmit={(event) => {
          void onCode(event);
        }}
        noValidate
      >
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <p>Enter the code from your authenticator app.</p>

        <Field
          name="code"
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          // Focused, because the person is already holding their phone and the next thing they do
          // should not be finding the field.
          autoFocus
          required
        />

        <p className="muted">
          Lost your phone? Use one of the recovery codes you saved when you turned this on.
        </p>

        <Button type="submit" loading={pending} fullWidth>
          {pending ? 'Checking…' : 'Sign in'}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        void onPassword(event);
      }}
      noValidate
    >
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <Field name="email" label="Email" type="email" autoComplete="email" required />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
      />

      <Button type="submit" loading={pending} fullWidth>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
