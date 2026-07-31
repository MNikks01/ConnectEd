'use client';

/**
 * Labelled text input with hint and error.
 *
 * The accessibility here is the whole point of the component. Getting it right once, centrally,
 * is the difference between a form that works with a screen reader and one that technically has
 * labels:
 *
 * - The label is a real `<label for>`, not a placeholder. Placeholders vanish on input and are not
 *   announced as names.
 * - Hint and error are wired through `aria-describedby`, so they are read *with* the field rather
 *   than orphaned next to it.
 * - `aria-invalid` marks the field itself, so a screen reader announces the error state on focus,
 *   not only when the user happens to reach the message.
 * - The error is `role="alert"`, so it is announced when it appears after a failed submit.
 */
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface FieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'id'
> {
  label: ReactNode;
  /** Guidance shown before the user makes a mistake — cheaper than an error afterwards. */
  hint?: ReactNode;
  error?: ReactNode;
}

export function Field({ label, hint, error, required, ...rest }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={id}>
        {label}
        {required ? (
          <>
            {' '}
            <span className="ui-field__required" aria-hidden="true">
              *
            </span>
            <span className="ui-visually-hidden">(required)</span>
          </>
        ) : null}
      </label>

      <input
        {...rest}
        id={id}
        required={required}
        className="ui-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
      />

      {hint ? (
        <span className="ui-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}

      {error ? (
        <span className="ui-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
