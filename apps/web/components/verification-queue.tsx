'use client';

import { Badge, Button, Dialog, Table, verificationTone } from '@connected/ui';
import type { MessageKey } from '@/lib/i18n/translate';
import { useTranslations } from './locale-provider';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { decideVerificationAction, decideVerificationsAction } from '@/app/(app)/school/actions';

import type { VerificationRequestResponse } from '@connected/types';

const FILTERS = ['PENDING', 'VERIFIED', 'REJECTED', 'REVOKED'] as const;

export function VerificationQueue({
  requests,
  status,
}: {
  requests: VerificationRequestResponse[];
  status: string;
}) {
  const { t } = useTranslations();

  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  /**
   * Rejection is confirmed; approval is not. Rejecting is the destructive direction — the person
   * is told no and has to reapply — and it is one click away from approving in the same row.
   */
  const [confirming, setConfirming] = useState<VerificationRequestResponse | undefined>();

  /**
   * Selection for deciding several at once (FR-VER-009). A school at the start of term has a
   * hundred students waiting, and one click each is the sort of thing that makes people stop.
   */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<string | undefined>();

  const selectable = requests.filter((request) => request.status === 'PENDING');

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSummary(undefined);
  }

  function decideSelected(decision: 'APPROVE' | 'REJECT') {
    setError(undefined);
    setSummary(undefined);

    startTransition(async () => {
      const result = await decideVerificationsAction([...selected], decision);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setSelected(new Set());

      // Reported rather than assumed. A school that approved thirty of forty is told about the
      // ten, with the reason the server gave for each.
      const failed = result.failed ?? [];
      setSummary(
        failed.length === 0
          ? `${String(result.decided ?? 0)} decided.`
          : `${String(result.decided ?? 0)} decided. ${String(failed.length)} could not be: ${failed
              .map((row) => row.reason)
              .join(' ')}`,
      );
    });
  }

  function decide(request: VerificationRequestResponse, decision: 'APPROVE' | 'REJECT') {
    setBusyId(request.id);
    setError(undefined);
    setConfirming(undefined);

    startTransition(async () => {
      const result = await decideVerificationAction(request.id, decision);
      if (!result.ok) setError(result.message);
      setBusyId(undefined);
    });
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      <nav aria-label={t('verificationQueue.filterNav')}>
        <ul className="filter-tabs">
          {FILTERS.map((value) => (
            <li key={value}>
              <Link
                href={`/school/verifications?status=${value}`}
                aria-current={status === value ? 'page' : undefined}
              >
                {/* Looked up, not title-cased. `charAt(0) + slice(1).toLowerCase()` is an
                    English rule about capitals, and it leaves "PENDING" untouched in scripts that
                    have none. */}
                {t(`verificationQueue.status${value}` as MessageKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {error ? (
        <p className="ui-field__error" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? <p role="status">{summary}</p> : null}

      {selectable.length > 0 ? (
        <div
          style={{
            display: 'flex',
            gap: 'var(--ui-space-3)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <label style={{ display: 'inline-flex', gap: 'var(--ui-space-2)', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={selected.size === selectable.length && selectable.length > 0}
              onChange={(event) => {
                // Selects what is *on this page*, which is what the checkbox is next to. A control
                // that silently included requests arriving while somebody read would approve people
                // they never saw.
                setSelected(
                  event.target.checked ? new Set(selectable.map((row) => row.id)) : new Set(),
                );
                setSummary(undefined);
              }}
            />
            <span>{t('verificationQueue.selectAll')}</span>
          </label>

          {selected.size > 0 ? (
            <>
              <Button
                size="sm"
                loading={pending}
                onClick={() => {
                  decideSelected('APPROVE');
                }}
              >
                {t('verificationQueue.approveSelected', { count: selected.size })}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() => {
                  decideSelected('REJECT');
                }}
              >
                {t('verificationQueue.rejectSelected', { count: selected.size })}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <Table
        caption={t('verificationQueue.caption', {
          status: t(`verificationQueue.status${status}` as MessageKey),
        })}
        captionVisible={false}
        columns={[
          {
            key: 'select',
            header: '',
            render: (request: VerificationRequestResponse) =>
              request.status === 'PENDING' ? (
                <input
                  type="checkbox"
                  checked={selected.has(request.id)}
                  onChange={() => {
                    toggle(request.id);
                  }}
                  aria-label={`Select ${request.requesterName ?? 'this request'}`}
                />
              ) : null,
          },
          {
            key: 'requester',
            header: t('verificationQueue.colRequester'),
            render: (request: VerificationRequestResponse) => (
              <>
                <div>{request.requesterName ?? t('verificationQueue.unknown')}</div>
                {request.requesterHandle ? (
                  <div className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                    @{request.requesterHandle}
                  </div>
                ) : null}
              </>
            ),
          },
          {
            key: 'role',
            header: t('verificationQueue.colRole'),
            render: (request: VerificationRequestResponse) => request.role,
          },
          {
            key: 'scope',
            header: t('verificationQueue.colScope'),
            render: (request: VerificationRequestResponse) =>
              request.childName
                ? `${request.childName} · ${request.className ?? '—'}`
                : (request.className ?? `${request.subjectIds.length} subject(s)`),
          },
          {
            key: 'status',
            header: t('verificationQueue.colStatus'),
            render: (request: VerificationRequestResponse) => (
              <Badge tone={verificationTone(request.status)}>{request.status}</Badge>
            ),
          },
          {
            key: 'actions',
            header: t('verificationQueue.colActions'),
            align: 'end',
            render: (request: VerificationRequestResponse) =>
              request.status === 'PENDING' ? (
                <div style={{ display: 'inline-flex', gap: 'var(--ui-space-2)' }}>
                  <Button
                    size="sm"
                    loading={pending && busyId === request.id}
                    onClick={() => {
                      decide(request, 'APPROVE');
                    }}
                  >
                    {t('verificationQueue.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending && busyId === request.id}
                    onClick={() => {
                      setConfirming(request);
                    }}
                  >
                    {t('verificationQueue.reject')}
                  </Button>
                </div>
              ) : (
                <span className="muted">{t('verificationQueue.decided')}</span>
              ),
          },
        ]}
        rows={requests}
        rowKey={(request) => request.id}
        empty={
          status === 'PENDING'
            ? t('verificationQueue.emptyPending')
            : t('verificationQueue.emptyOther')
        }
      />

      <Dialog
        open={confirming !== undefined}
        onClose={() => {
          setConfirming(undefined);
        }}
        title={t('verificationQueue.rejectTitle')}
        description={
          confirming
            ? t('verificationQueue.rejectBody', {
                name: confirming.requesterName ?? t('verificationQueue.thisPerson'),
              })
            : undefined
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirming(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirming) decide(confirming, 'REJECT');
              }}
            >
              {t('verificationQueue.rejectConfirm')}
            </Button>
          </>
        }
      />
    </div>
  );
}
