'use client';

/**
 * Error boundary for the portal.
 *
 * Shows the API's message when there is one — those are written to be safe to display — and always
 * offers a retry, because most failures here are transient. `digest` is surfaced so a support
 * conversation can tie the screen to a server log line.
 */
import { Alert, Button, Card } from '@connected/ui';
import { useTranslations } from '@/components/locale-provider';

export default function SchoolError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslations();

  return (
    <Card as="section">
      <Alert tone="danger" title={t('errorPages.somethingWentWrong')}>
        {error.message || t('errorPages.portalFailed')}
      </Alert>

      {error.digest ? (
        <p className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
          {t('errorPages.reference', { digest: error.digest })}
        </p>
      ) : null}

      <div style={{ marginTop: 'var(--ui-space-4)' }}>
        <Button onClick={reset}>{t('errorPages.tryAgain')}</Button>
      </div>
    </Card>
  );
}
