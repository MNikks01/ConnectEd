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
import { useTranslations } from '@/components/locale-provider';
import { formatDate as formatLocalisedDate } from '@/lib/i18n/format';

import type { MessageKey, Translator } from '@/lib/i18n/translate';
import type { Locale } from '@/lib/i18n/locales';
import type { StatusTone } from '@connected/ui';
import type { DataExportResponse, PrivacyStatusResponse } from '@connected/types';

/**
 * `PENDING` and `BUILDING` deliberately share one label. The distinction is real to the worker and
 * meaningless to the person waiting, and inventing two words for it would only invite a translator
 * to find two that differ.
 */
const STATUS_LABEL: Record<DataExportResponse['status'], MessageKey> = {
  PENDING: 'privacy.statusPending',
  BUILDING: 'privacy.statusPending',
  READY: 'privacy.statusReady',
  FAILED: 'privacy.statusFailed',
  EXPIRED: 'privacy.statusExpired',
};

function toneFor(status: DataExportResponse['status']): StatusTone {
  if (status === 'READY') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'EXPIRED') return 'neutral';
  return 'info';
}

/**
 * Shared rather than local, so this page cannot drift from the rest of the product on the one
 * detail that made dates worth centralising: a UI locale code is not a formatting tag.
 */
const formatDate = formatLocalisedDate;

/** The unit is part of the sentence, so it comes from the catalogue rather than being appended. */
function formatSize(bytes: number | null, t: Translator, locale: Locale): string {
  if (bytes === null) return '';

  const number = (value: number, digits = 0) =>
    value.toLocaleString(locale, { maximumFractionDigits: digits });

  if (bytes < 1024) return t('privacy.bytes', { count: number(bytes) });
  if (bytes < 1024 * 1024) return t('privacy.kilobytes', { count: number(bytes / 1024) });
  return t('privacy.megabytes', { count: number(bytes / (1024 * 1024), 1) });
}

export function PrivacyPanel({
  status,
  exports,
}: {
  status: PrivacyStatusResponse;
  exports: DataExportResponse[];
}) {
  const { t, locale } = useTranslations();
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
        setError(result.message ?? t('common.somethingWentWrong'));
      }
    });
  }

  return (
    <>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
          {t('privacy.exportHeading')}
        </h2>
        <p>{t('privacy.exportIntro')}</p>

        <Button
          loading={pending}
          disabled={outstanding || erasure !== null}
          onClick={() => {
            act(() => requestExportAction(), t('privacy.requestedNotice'));
          }}
        >
          {t('privacy.requestCopy')}
        </Button>

        {erasure ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            {t('privacy.notWhileErasing')}
          </p>
        ) : null}

        {exports.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            {t('privacy.noExportsYet')}
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
                <Badge tone={toneFor(row.status)}>{t(STATUS_LABEL[row.status])}</Badge>
                <span>
                  {t('privacy.requestedOn', { date: formatDate(row.requestedAt, locale) })}
                </span>

                {row.status === 'READY' && row.expiresAt ? (
                  <span className="muted">
                    {t('privacy.availableUntil', {
                      size: formatSize(row.sizeBytes, t, locale),
                      date: formatDate(row.expiresAt, locale),
                    })}
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
                          setError(result.message ?? t('privacy.downloadFailed'));
                        }
                      });
                    }}
                  >
                    {t('privacy.download')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>{t('privacy.eraseHeading')}</h2>

        {!status.mayErase ? (
          // Explained rather than hidden, for the same reason the security page explains who may
          // enrol in 2FA: a bare absence reads as a missing feature.
          <p style={{ marginBottom: 0 }}>{t('privacy.schoolCannotErase')}</p>
        ) : erasure ? (
          <>
            <Alert tone="warning">
              {t('privacy.scheduledOn', { date: formatDate(erasure.scheduledFor, locale) })}
            </Alert>

            <Button
              variant="secondary"
              loading={pending}
              onClick={() => {
                act(() => cancelErasureAction(), t('privacy.cancelledNotice'));
              }}
            >
              {t('privacy.keepAccount')}
            </Button>
          </>
        ) : (
          <>
            <p>{t('privacy.graceExplained')}</p>

            <Field
              label={t('privacy.confirmLabel')}
              name="confirm"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
              }}
              hint={t('privacy.confirmHint')}
            />

            <Button
              variant="danger"
              loading={pending}
              disabled={confirm !== 'ERASE'}
              onClick={() => {
                act(() => requestErasureAction(confirm), t('privacy.scheduledNotice'));
                setConfirm('');
              }}
            >
              {t('privacy.scheduleDeletion')}
            </Button>
          </>
        )}
      </Card>
    </>
  );
}
