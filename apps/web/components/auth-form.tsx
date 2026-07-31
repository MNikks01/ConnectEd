'use client';

/**
 * Shared client behaviour for the login and register forms.
 *
 * Every state the frontend checklist requires is handled here rather than in each page: submitting
 * (button disabled, `aria-busy`), field-level errors from the API's 422 `details`, a form-level
 * error announced to screen readers via `role="alert"`, and success (redirect).
 */
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
    // `void` because a form's onSubmit must return nothing; an unhandled rejection would
    // otherwise escape silently. Every failure path inside `onSubmit` is already caught.
    <form onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={pending}>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <FieldErrorContext.Provider value={fieldErrors}>{children}</FieldErrorContext.Provider>

      <button type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}

export interface FieldProps {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}

/** A labelled input that wires its error message to the control for screen readers. */
export function Field({ name, label, type = 'text', autoComplete, required, hint }: FieldProps) {
  const errors = useContext(FieldErrorContext);
  const error = errors[name];
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [error ? errorId : undefined, hint ? hintId : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
      />
      {hint ? (
        <span id={hintId} className="muted" style={{ fontSize: '0.85rem' }}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="field-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
