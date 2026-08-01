'use client';

/**
 * Badge and Alert — the two ways this product reports state.
 *
 * **Colour is never the only signal.** Every badge carries its label as text, and every alert has
 * a text prefix naming its kind. Roughly one in twelve men has some colour-vision deficiency, and
 * a verification queue that distinguishes approved from rejected purely by red and green is
 * unreadable to them (WCAG 1.4.1).
 */
import type { ReactNode } from 'react';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  tone?: StatusTone;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

export interface AlertProps {
  tone?: Exclude<StatusTone, 'neutral'>;
  title?: ReactNode;
  children: ReactNode;
}

const TONE_PREFIX: Record<Exclude<StatusTone, 'neutral'>, string> = {
  info: 'Note',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

export function Alert({ tone = 'info', title, children }: AlertProps) {
  return (
    <div
      className={`ui-alert ui-alert--${tone}`}
      // Errors interrupt; everything else waits for a pause in speech.
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <p className="ui-alert__title">{title ?? TONE_PREFIX[tone]}</p>
      <div className="ui-alert__body">{children}</div>
    </div>
  );
}

/** Maps a `VerificationStatus` to a tone, so the queue reads the same wherever it is rendered. */
export function verificationTone(status: string): StatusTone {
  switch (status) {
    case 'VERIFIED':
      return 'success';
    case 'REJECTED':
    case 'REVOKED':
      return 'danger';
    case 'PENDING':
      return 'warning';
    default:
      return 'neutral';
  }
}
