'use client';

/**
 * Export and erasure, as a person meets them (FR-DSR-001 … 028).
 *
 * Three decisions in here are about wording rather than code, and each is load-bearing.
 *
 * **The export says what it is doing, not that it succeeded.** A request returns before the file
 * exists, so the button's answer is "we are preparing it" and the section below is the truth. A
 * "Done." on an action that has not happened yet is the shape of message this repo has already been
 * caught by.
 *
 * **Erasure is asked for by typing, not by clicking.** It is the only irreversible action in the
 * product; a checkbox is easy to click past and a word is not. That is a speed bump rather than a
 * security control, and it is worth exactly as much as it costs.
 *
 * **The pending state leads with the date and the way out.** Somebody arriving at this page during
 * the grace period is far more likely to be looking for "cancel" than for anything else.
 */
import { Alert, Badge, Button, Card, Field } from '@connected/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  cancelErasureAction,
  downloadExportAction,
  requestErasureAction,
  requestExportAction,
} from '@/app/(app)/(member)/actions';

import type { StatusTone } from '@connected/ui';
import type { DataExportResponse, PrivacyStatusResponse } from '@connected/types';

const STATUS_LABEL: Record<DataExportResponse['status'], string> = {
  PENDING: 'Being prepared',
  BUILDING: 'Being prepared',
  READY: 'Ready to download',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};

function toneFor(status: DataExportResponse['status']): StatusTone {
  if (status === 'READY') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'EXPIRED') return 'neutral';
  return 'info';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${String(bytes)} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PrivacyPanel({
  status,
  exports,
}: {
  status: PrivacyStatusResponse;
  exports: DataExportResponse[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [confirm, setConfirm] = useState('');

  const outstanding = exports.some((row) => row.status === 'PENDING' || row.status === 'BUILDING');
  const erasure = status.pendingErasure;

  function act(run: () => Promise<{ ok: boolean; message?: string }>, done?: string) {
    setError(undefined);
    setMessage(undefined);

    startTransition(async () => {
      const result = await run();

      if (result.ok) {
        if (done) setMessage(done);
        // The server is the source of truth for both flows; refreshing is what makes the status
        // below reflect what actually happened rather than what was optimistically assumed.
        router.refresh();
      } else {
        setError(result.message ?? 'Something went wrong.');
      }
    });
  }

  return (
    <>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Download your data</h2>
        <p>
          One file containing your profile, your memberships, your marks, your attendance, your
          report cards, and everything you have written. It takes a moment to prepare, and the link
          works for seven days.
        </p>

        <Button
          loading={pending}
          disabled={outstanding || erasure !== null}
          onClick={() => {
            act(
              () => requestExportAction(),
              'We are preparing your file. This page will show it when it is ready.',
            );
          }}
        >
          Request a copy
        </Button>

        {erasure ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Not while your account is scheduled for deletion — cancel that first.
          </p>
        ) : null}

        {exports.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            You have not asked for a copy before.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
            {exports.map((row) => (
              <li
                key={row.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--ui-space-2)',
                  alignItems: 'center',
                }}
              >
                <Badge tone={toneFor(row.status)}>{STATUS_LABEL[row.status]}</Badge>
                <span>Requested {formatDate(row.requestedAt)}</span>

                {row.status === 'READY' && row.expiresAt ? (
                  <span className="muted">
                    {formatSize(row.sizeBytes)} · available until {formatDate(row.expiresAt)}
                  </span>
                ) : null}

                {row.status === 'FAILED' && row.error ? (
                  <span className="muted">{row.error}</span>
                ) : null}

                {row.status === 'READY' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={pending}
                    onClick={() => {
                      setError(undefined);
                      startTransition(async () => {
                        const result = await downloadExportAction(row.id);

                        if (result.ok && result.url) {
                          // A one-time URL fetched and used immediately. Not a link in the markup:
                          // it is a credential with a five-minute life, and putting it in an href
                          // would leave it in the page source and in browser history.
                          window.location.assign(result.url);
                        } else {
                          setError(result.message ?? 'That file could not be fetched.');
                        }
                      });
                    }}
                  >
                    Download
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Delete your account</h2>

        {!status.mayErase ? (
          <p style={{ marginBottom: 0 }}>
            {/* Explained rather than hidden, for the same reason the security page explains who may
                enrol in 2FA: a bare absence reads as a missing feature. */}
            A school account cannot be deleted here. Its classes, registers and report cards belong
            to its pupils and their families as much as to the institution, so closing one is a
            conversation rather than a button. Get in touch and we will walk through it.
          </p>
        ) : erasure ? (
          <>
            <Alert tone="warning">
              Your account is scheduled for deletion on{' '}
              <strong>{formatDate(erasure.scheduledFor)}</strong>. Until then everything works
              normally, and you can stop it.
            </Alert>

            <Button
              variant="secondary"
              loading={pending}
              onClick={() => {
                act(() => cancelErasureAction(), 'Your account will not be deleted.');
              }}
            >
              Keep my account
            </Button>
          </>
        ) : (
          <>
            <p>
              We will wait <strong>30 days</strong> before deleting anything, and you can change
              your mind at any point in that time. After that it cannot be undone.
            </p>

            <Field
              label="Type ERASE to confirm"
              name="confirm"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
              }}
              hint="A deliberate speed bump before the one thing on this site that cannot be reversed."
            />

            <Button
              variant="danger"
              loading={pending}
              disabled={confirm !== 'ERASE'}
              onClick={() => {
                act(
                  () => requestErasureAction(confirm),
                  'Your account is scheduled for deletion. You can stop it at any point in the next 30 days.',
                );
                setConfirm('');
              }}
            >
              Schedule deletion
            </Button>
          </>
        )}
      </Card>
    </>
  );
}
