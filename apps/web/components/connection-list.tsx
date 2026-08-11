'use client';

/**
 * Connection requests and connections.
 *
 * "Waiting on them" and "waiting on you" are the same row from different sides, so the list uses
 * `requestedByMe` to decide which buttons to offer rather than showing both to everyone.
 */
import { Badge, Button, Card } from '@connected/ui';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { respondToConnectionAction } from '@/app/(app)/(member)/actions';
import { useTranslations } from './locale-provider';

import type { ConnectionResponse } from '@connected/types';

export function ConnectionList({
  connections,
  emptyMessage,
}: {
  connections: ConnectionResponse[];
  emptyMessage: string;
}) {
  const { t } = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function respond(id: string, accept: boolean) {
    setError(undefined);

    startTransition(async () => {
      const result = await respondToConnectionAction(id, accept);
      if (!result.ok) setError(result.message);
    });
  }

  if (connections.length === 0) {
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
        {connections.map((connection) => (
          <li key={connection.id}>
            <Card>
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--ui-space-2)',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Link href={`/accounts/${connection.other.accountId}`}>
                  {connection.other.displayName}
                </Link>
                {connection.status === 'PENDING' ? (
                  <Badge tone="warning">
                    {connection.requestedByMe
                      ? t('connectionList.waitingOnThem')
                      : t('connectionList.waitingOnYou')}
                  </Badge>
                ) : (
                  <Badge tone="success">{t('connectionList.connected')}</Badge>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 'var(--ui-space-3)',
                  marginTop: 'var(--ui-space-3)',
                }}
              >
                {connection.status === 'PENDING' && !connection.requestedByMe ? (
                  <Button
                    size="sm"
                    loading={pending}
                    onClick={() => {
                      respond(connection.id, true);
                    }}
                  >
                    {t('connectionList.accept')}
                  </Button>
                ) : null}

                <Button
                  size="sm"
                  variant="secondary"
                  loading={pending}
                  onClick={() => {
                    respond(connection.id, false);
                  }}
                >
                  {/* One endpoint, three words, depending on who is looking at what. */}
                  {connection.status === 'ACCEPTED'
                    ? t('connectionList.disconnect')
                    : connection.requestedByMe
                      ? t('connectionList.cancel')
                      : t('connectionList.decline')}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
