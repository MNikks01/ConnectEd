'use client';

import { Badge, Button, Table } from '@connected/ui';
import { useTranslations } from './locale-provider';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { setClassActiveAction } from '@/app/(app)/school/actions';

import type { ClassResponse } from '@connected/types';

export function ClassTable({ classes }: { classes: ClassResponse[] }) {
  const [pending, startTransition] = useTransition();
  const { t } = useTranslations();
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
        caption={t('classTable.caption')}
        columns={[
          {
            key: 'name',
            header: t('classTable.colClass'),
            render: (klass: ClassResponse) => (
              <Link href={`/school/classes/${klass.id}`}>{klass.displayName}</Link>
            ),
          },
          {
            key: 'subjects',
            header: t('classTable.colSubjects'),
            align: 'end',
            render: (klass: ClassResponse) => klass.subjectCount,
          },
          {
            key: 'status',
            header: t('classTable.colStatus'),
            render: (klass: ClassResponse) => (
              // Text, not colour alone — the badge label says which state it is.
              <Badge tone={klass.active ? 'success' : 'neutral'}>
                {klass.active ? t('classTable.active') : t('classTable.inactive')}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: t('classTable.colActions'),
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
                {klass.active ? t('classTable.deactivate') : t('classTable.reactivate')}
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
