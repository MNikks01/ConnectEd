'use client';

import { Badge, Button, Dialog, Table } from '@connected/ui';
import { useState, useTransition } from 'react';

import { revokeMemberAction } from '@/app/(app)/school/actions';

import type { SchoolMemberResponse } from '@connected/types';

export function MemberRoster({
  schoolId,
  members,
}: {
  schoolId: string;
  members: SchoolMemberResponse[];
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  /** Removal is irreversible from the member's side — they must reapply — so it is confirmed. */
  const [confirming, setConfirming] = useState<SchoolMemberResponse | undefined>();

  function revoke(member: SchoolMemberResponse) {
    setBusyId(member.accountId);
    setError(undefined);
    setConfirming(undefined);

    startTransition(async () => {
      const result = await revokeMemberAction(schoolId, member.accountId);
      if (!result.ok) setError(result.message);
      setBusyId(undefined);
    });
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      {error ? (
        <p className="ui-field__error" role="alert">
          {error}
        </p>
      ) : null}

      <Table
        caption="Verified members"
        captionVisible={false}
        columns={[
          {
            key: 'person',
            header: 'Member',
            render: (member: SchoolMemberResponse) => (
              <>
                <div>{member.fullName ?? 'Unknown'}</div>
                {member.handle ? (
                  <div className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
                    @{member.handle}
                  </div>
                ) : null}
              </>
            ),
          },
          {
            key: 'role',
            header: 'Role',
            render: (member: SchoolMemberResponse) => <Badge tone="info">{member.role}</Badge>,
          },
          {
            key: 'scope',
            header: 'Scope',
            render: (member: SchoolMemberResponse) =>
              member.childName
                ? `${member.childName} · ${member.className ?? '—'}`
                : (member.className ?? 'School-wide'),
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'end',
            render: (member: SchoolMemberResponse) => (
              <Button
                variant="secondary"
                size="sm"
                disabled={pending && busyId === member.accountId}
                onClick={() => {
                  setConfirming(member);
                }}
              >
                Remove
              </Button>
            ),
          },
        ]}
        rows={members}
        rowKey={(member) => `${member.accountId}-${member.role}-${member.classId ?? ''}`}
        empty="No verified members yet. Approve a request to add the first."
      />

      <Dialog
        open={confirming !== undefined}
        onClose={() => {
          setConfirming(undefined);
        }}
        title="Remove this member?"
        description={
          confirming
            ? `${confirming.fullName ?? 'This person'} loses access to this school immediately and would have to be verified again.`
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
                if (confirming) revoke(confirming);
              }}
            >
              Remove member
            </Button>
          </>
        }
      />
    </div>
  );
}
