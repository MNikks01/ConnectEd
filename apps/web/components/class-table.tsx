'use client';

import { Badge, Button, Table } from '@connected/ui';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { setClassActiveAction } from '@/app/(app)/school/actions';

import type { ClassResponse } from '@connected/types';

export function ClassTable({ classes }: { classes: ClassResponse[] }) {
  const [pending, startTransition] = useTransition();
  // Tracked per row so toggling one class does not put every button in a busy state.
  const [busyId, setBusyId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  function toggle(klass: ClassResponse) {
    setBusyId(klass.id);
    setError(undefined);

    startTransition(async () => {
      const result = await setClassActiveAction(klass.id, !klass.active);
      if (!result.ok) setError(result.message);
      setBusyId(undefined);
    });
  }

  return (
    <div>
      {error ? (
        <p className="ui-field__error" role="alert" style={{ marginBottom: 'var(--ui-space-3)' }}>
          {error}
        </p>
      ) : null}

      <Table
        caption="Classes"
        columns={[
          {
            key: 'name',
            header: 'Class',
            render: (klass: ClassResponse) => (
              <Link href={`/school/classes/${klass.id}`}>{klass.displayName}</Link>
            ),
          },
          {
            key: 'subjects',
            header: 'Subjects',
            align: 'end',
            render: (klass: ClassResponse) => klass.subjectCount,
          },
          {
            key: 'status',
            header: 'Status',
            render: (klass: ClassResponse) => (
              // Text, not colour alone — the badge label says which state it is.
              <Badge tone={klass.active ? 'success' : 'neutral'}>
                {klass.active ? 'Active' : 'Inactive'}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'end',
            render: (klass: ClassResponse) => (
              <Button
                variant="secondary"
                size="sm"
                loading={pending && busyId === klass.id}
                onClick={() => {
                  toggle(klass);
                }}
              >
                {klass.active ? 'Deactivate' : 'Reactivate'}
              </Button>
            ),
          },
        ]}
        rows={classes}
        rowKey={(klass) => klass.id}
        empty="No classes yet. Add the first one below."
      />
    </div>
  );
}
