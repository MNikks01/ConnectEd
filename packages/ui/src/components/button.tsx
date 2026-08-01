'use client';

/**
 * Button.
 *
 * Notes that are easy to get wrong and expensive to fix later:
 *
 * - `type` defaults to `button`. HTML's default is `submit`, which makes any button dropped into a
 *   form silently submit it — a bug that only shows up in the one flow nobody tested.
 * - `loading` sets `aria-busy` and *keeps the label*, so the accessible name never changes
 *   mid-interaction and the button does not resize under the cursor.
 * - The disabled state keeps a 4.5:1 label. Greying a control to illegibility is common and fails
 *   AA for everyone who has to read *why* something is unavailable.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  type = 'button',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    fullWidth ? 'ui-button--full' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      // A loading button must not be re-invoked, but it is not permanently unavailable either.
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
