'use client';

/**
 * A form driven by a Server Action, with the states the frontend checklist requires.
 *
 * `useTransition` rather than a `pending` boolean: it reflects the *server* round trip including
 * the revalidation that follows, so the button stays busy until the page actually shows the new
 * data. A local boolean flips back the moment the promise resolves, which produces a brief window
 * where the form looks done but the list has not updated.
 *
 * Success is announced through a `role="status"` region, so a screen-reader user learns the class
 * was created — otherwise the only feedback is a visual list they may not be looking at.
 */
import { Alert, Button } from '@connected/ui';
import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';

import type { ActionResult } from '@/app/(app)/school/actions';

const FieldErrorContext = createContext<Record<string, string>>({});

export function useFieldError(name: string): string | undefined {
  return useContext(FieldErrorContext)[name];
}

export interface ActionFormProps {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  pendingLabel: string;
  successMessage: string;
  children: ReactNode;
  /** Clears the inputs on success — right for "add another", wrong for an edit form. */
  resetOnSuccess?: boolean;
}

export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  successMessage,
  children,
  resetOnSuccess = false,
}: ActionFormProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | undefined>();

  return (
    <form
      aria-busy={pending}
      action={(formData) => {
        setResult(undefined);
        startTransition(async () => {
          const outcome = await action(formData);
          setResult(outcome);
        });
      }}
      onSubmit={(event) => {
        if (resetOnSuccess) {
          // Reset optimistically; a failure re-renders the message and the user retypes one field.
          const form = event.currentTarget;
          setTimeout(() => {
            form.reset();
          }, 0);
        }
      }}
    >
      {result && !result.ok ? (
        <div style={{ marginBottom: 'var(--ui-space-4)' }}>
          <Alert tone="danger">{result.message}</Alert>
        </div>
      ) : null}

      {result?.ok ? (
        <div style={{ marginBottom: 'var(--ui-space-4)' }}>
          <Alert tone="success">{successMessage}</Alert>
        </div>
      ) : null}

      <FieldErrorContext.Provider value={result?.fieldErrors ?? {}}>
        {children}
      </FieldErrorContext.Provider>

      <div style={{ marginTop: 'var(--ui-space-4)' }}>
        <Button type="submit" loading={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
