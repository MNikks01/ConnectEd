'use client';

import { Badge, Button, Dialog, Table, verificationTone } from '@connected/ui';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { decideVerificationAction } from '@/app/(app)/school/actions';

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

      <Table
        caption={`${status.charAt(0)}${status.slice(1).toLowerCase()} verification requests`}
        captionVisible={false}
        columns={[
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
