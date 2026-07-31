'use client';

/**
 * Error boundary for the portal.
 *
 * Shows the API's message when there is one — those are written to be safe to display — and always
 * offers a retry, because most failures here are transient. `digest` is surfaced so a support
 * conversation can tie the screen to a server log line.
 */
import { Alert, Button, Card } from '@connected/ui';

export default function SchoolError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card as="section">
      <Alert tone="danger" title="Something went wrong">
        {error.message || 'The portal could not be loaded.'}
      </Alert>

      {error.digest ? (
        <p className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
          Reference: {error.digest}
        </p>
      ) : null}

      <div style={{ marginTop: 'var(--ui-space-4)' }}>
        <Button onClick={reset}>Try again</Button>
      </div>
    </Card>
  );
}
