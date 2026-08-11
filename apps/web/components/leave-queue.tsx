'use client';

/**
 * A queue of leave applications waiting on the caller's decision.
 *
 * Rejection is confirmed and acceptance is not: one of them is the answer a family is hoping for,
 * and the other is the one worth being sure about. The same asymmetry the verification queue uses.
 */
import { Badge, Button, Card, Dialog } from '@connected/ui';
import { useState, useTransition } from 'react';

import { decideLeaveAction } from '@/app/(app)/(member)/actions';
import { formatCalendarDay } from '@/lib/i18n/format';
import { useTranslations } from './locale-provider';

import type { Locale } from '@/lib/i18n/locales';
import type { MessageKey } from '@/lib/i18n/translate';
import type { LeaveApplicationResponse } from '@connected/types';

/** Waiting, accepted, rejected — words from the catalogue, never a lowercased enum. */
const STATUS_LABEL: Record<string, MessageKey> = {
  RECEIVED: 'leaveQueue.statusRECEIVED',
  ACCEPTED: 'leaveQueue.statusACCEPTED',
  REJECTED: 'leaveQueue.statusREJECTED',
};

function dateRange(leave: LeaveApplicationResponse, locale: Locale): string {
  const format = (value: string) => formatCalendarDay(value, locale);

  return leave.startDate === leave.endDate
    ? format(leave.startDate)
    : `${format(leave.startDate)} — ${format(leave.endDate)}`;
}

export function LeaveQueue({
  applications,
  emptyMessage,
}: {
  applications: LeaveApplicationResponse[];
  emptyMessage: string;
}) {
  const { t, locale } = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<LeaveApplicationResponse | undefined>();

  function decide(leave: LeaveApplicationResponse, decision: 'ACCEPT' | 'REJECT') {
    setError(undefined);
    setConfirming(undefined);

    startTransition(async () => {
      const result = await decideLeaveAction(leave.id, decision);
      if (!result.ok) setError(result.message);
    });
  }

  if (applications.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <>
      {error ? (
        <p className="ui-field__error" role="alert">
          {error}
        </p>
      ) : null}

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
        {applications.map((leave) => (
          <li key={leave.id}>
            <Card>
              <p className="muted" style={{ margin: 0, fontSize: 'var(--ui-text-sm)' }}>
                {dateRange(leave, locale)}
              </p>

              <h3 style={{ margin: '0.25rem 0 0.5rem', fontSize: 'var(--ui-text-base)' }}>
                {leave.childName ?? leave.applicantName ?? t('leaveQueue.applicantFallback')}
                {leave.className ? ` · ${leave.className}` : ''}
              </h3>

              <p style={{ margin: '0 0 var(--ui-space-3)', whiteSpace: 'pre-wrap' }}>
                {leave.reason}
              </p>

              <div style={{ display: 'flex', gap: 'var(--ui-space-3)', alignItems: 'center' }}>
                <Button
                  size="sm"
                  loading={pending}
                  onClick={() => {
                    decide(leave, 'ACCEPT');
                  }}
                >
                  {t('leaveQueue.accept')}
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setConfirming(leave);
                  }}
                >
                  {t('leaveQueue.reject')}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog
        open={confirming !== undefined}
        title={t('leaveQueue.rejectTitle')}
        onClose={() => {
          setConfirming(undefined);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirming(undefined);
              }}
            >
              {t('leaveQueue.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => {
                if (confirming) decide(confirming, 'REJECT');
              }}
            >
              {t('leaveQueue.rejectConfirm')}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>{t('leaveQueue.rejectExplained')}</p>
      </Dialog>
    </>
  );
}

/** The applicant's own list: status, not buttons. */
export function LeaveHistory({ applications }: { applications: LeaveApplicationResponse[] }) {
  const { t, locale } = useTranslations();

  if (applications.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>{t('leaveQueue.noneApplied')}</p>
      </Card>
    );
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
      {applications.map((leave) => (
        <li key={leave.id}>
          <Card>
            <div
              style={{
                display: 'flex',
                gap: 'var(--ui-space-2)',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              {/* The word, not only a colour. */}
              <Badge
                tone={
                  leave.status === 'ACCEPTED'
                    ? 'success'
                    : leave.status === 'REJECTED'
                      ? 'danger'
                      : 'info'
                }
              >
                {t(STATUS_LABEL[leave.status] as MessageKey)}
              </Badge>
              <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                {dateRange(leave, locale)}
              </span>
            </div>

            <p style={{ margin: 'var(--ui-space-2) 0 0' }}>
              {leave.childName ? `${leave.childName} · ` : ''}
              {leave.reason}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
