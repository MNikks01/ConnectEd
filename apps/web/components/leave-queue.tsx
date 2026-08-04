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

import type { LeaveApplicationResponse } from '@connected/types';

function dateRange(leave: LeaveApplicationResponse): string {
  const format = (value: string) =>
    new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });

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
                {dateRange(leave)}
              </p>

              <h3 style={{ margin: '0.25rem 0 0.5rem', fontSize: 'var(--ui-text-base)' }}>
                {leave.childName ?? leave.applicantName ?? 'Applicant'}
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
                  Accept
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setConfirming(leave);
                  }}
                >
                  Reject
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog
        open={confirming !== undefined}
        title="Reject this application?"
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
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => {
                if (confirming) decide(confirming, 'REJECT');
              }}
            >
              Reject application
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          The applicant is told. A rejected application cannot be reopened — they would have to
          apply again.
        </p>
      </Dialog>
    </>
  );
}

/** The applicant's own list: status, not buttons. */
export function LeaveHistory({ applications }: { applications: LeaveApplicationResponse[] }) {
  if (applications.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>You have not applied for any leave.</p>
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
                {leave.status === 'RECEIVED' ? 'Waiting' : leave.status.toLowerCase()}
              </Badge>
              <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                {dateRange(leave)}
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
