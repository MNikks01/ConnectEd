'use client';

import { Badge, Button, Dialog, Table, verificationTone } from '@connected/ui';
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
      <nav aria-label="Filter by status">
        <ul className="filter-tabs">
          {FILTERS.map((value) => (
            <li key={value}>
              <Link
                href={`/school/verifications?status=${value}`}
                aria-current={status === value ? 'page' : undefined}
              >
                {value.charAt(0) + value.slice(1).toLowerCase()}
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
            <span>Select all pending on this page</span>
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
                Approve {selected.size}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() => {
                  decideSelected('REJECT');
                }}
              >
                Reject {selected.size}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <Table
        caption={`${status.charAt(0)}${status.slice(1).toLowerCase()} verification requests`}
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
            header: 'Requester',
            render: (request: VerificationRequestResponse) => (
              <>
                <div>{request.requesterName ?? 'Unknown'}</div>
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
            header: 'Role',
            render: (request: VerificationRequestResponse) => request.role,
          },
          {
            key: 'scope',
            header: 'Scope',
            render: (request: VerificationRequestResponse) =>
              request.childName
                ? `${request.childName} · ${request.className ?? '—'}`
                : (request.className ?? `${request.subjectIds.length} subject(s)`),
          },
          {
            key: 'status',
            header: 'Status',
            render: (request: VerificationRequestResponse) => (
              <Badge tone={verificationTone(request.status)}>{request.status}</Badge>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
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
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending && busyId === request.id}
                    onClick={() => {
                      setConfirming(request);
                    }}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <span className="muted">Decided</span>
              ),
          },
        ]}
        rows={requests}
        rowKey={(request) => request.id}
        empty={
          status === 'PENDING'
            ? 'Nothing waiting. New requests appear here as members apply.'
            : `No ${status.toLowerCase()} requests.`
        }
      />

      <Dialog
        open={confirming !== undefined}
        onClose={() => {
          setConfirming(undefined);
        }}
        title="Reject this request?"
        description={
          confirming
            ? `${confirming.requesterName ?? 'This person'} will not get access, and will be able to apply again.`
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
              Reject request
            </Button>
          </>
        }
      />
    </div>
  );
}
