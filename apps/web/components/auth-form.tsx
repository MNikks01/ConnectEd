'use client';

/**
 * Shared client behaviour for the login and register forms.
 *
 * Presentation now comes from `@connected/ui` — this file owns submission, error mapping, and the
 * six states the frontend checklist requires, not styling. Field-level errors from the API's 422
 * `details` are routed to the matching `Field`, which handles the `aria-describedby` wiring.
 */
import { Alert, Button, Field } from '@connected/ui';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react';

import type { ErrorEnvelope } from '@connected/types';

/** Field-level messages from the API's 422 `details`, keyed by field name. */
const FieldErrorContext = createContext<Record<string, string>>({});

export interface AuthFormProps {
  /** This app's route handler, not the API — the browser never calls the API directly. */
  action: string;
  submitLabel: string;
  pendingLabel: string;
  redirectTo: string;
  children: ReactNode;
}

export function AuthForm({
  action,
  submitLabel,
  pendingLabel,
  redirectTo,
  children,
}: AuthFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(undefined);
    setFieldErrors({});

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const response = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // refresh() re-runs the Server Components so the new session cookie is picked up.
        router.push(redirectTo);
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => undefined)) as ErrorEnvelope | undefined;
      const error = body?.error;

      if (error?.details?.length) {
        setFieldErrors(
          Object.fromEntries(error.details.map((detail) => [detail.field, detail.issue])),
        );
      }

      // The API's copy is already written to be safe to display and free of internals.
      setFormError(error?.message ?? 'Something went wrong. Please try again.');
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    // `void` because a form's onSubmit must return nothing; every failure path inside is caught.
    <form onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={pending}>
      {formError ? (
        <div style={{ marginBottom: 'var(--ui-space-4)' }}>
          <Alert tone="danger">{formError}</Alert>
        </div>
      ) : null}

      <FieldErrorContext.Provider value={fieldErrors}>{children}</FieldErrorContext.Provider>

      <div style={{ marginTop: 'var(--ui-space-5)' }}>
        <Button type="submit" loading={pending} fullWidth>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export interface FormFieldProps {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}

/** Thin wrapper that pulls this field's server-side error out of context. */
export function FormField({ name, label, ...rest }: FormFieldProps) {
  const errors = useContext(FieldErrorContext);

  return (
    <div style={{ marginBottom: 'var(--ui-space-4)' }}>
      <Field {...rest} name={name} label={label} error={errors[name]} />
    </div>
  );
}
