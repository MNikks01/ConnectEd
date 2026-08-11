/**
 * Public landing page. No session and no personalization, so it was prerendered at build time
 * (`.docs/Architecture/03-frontend-architecture.md`).
 *
 * It is now rendered per request instead, and the reason is the content security policy: the nonce
 * that permits Next's own scripts is minted per response, and HTML built once at build time cannot
 * carry it. A prerendered page under this policy loads its markup and then hydrates nothing.
 *
 * What that costs here is the prerender, not the SEO — a crawler is served the same complete HTML
 * either way, and this page has nothing to fetch before it can be sent.
 */
import { Card } from '@connected/ui';
import Link from 'next/link';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { getTranslations } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const { t } = await getTranslations();

  return (
    <main>
      <h1>{t('marketing.title')}</h1>
      <p className="muted">{t('marketing.tagline')}</p>

      <Card>
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>{t('marketing.getStarted')}</h2>
        <p>
          <Link href="/login">{t('marketing.signIn')}</Link> {t('marketing.or')}{' '}
          <Link href="/register">{t('marketing.createAccount')}</Link>.
        </p>
        <p className="muted" style={{ fontSize: 'var(--ui-text-sm)', marginBottom: 0 }}>
          {t('marketing.webOnlyNote')}
        </p>
      </Card>

      {/* On the landing page rather than only behind a sign-in: somebody deciding whether this
          product speaks their language has not got an account yet. */}
      <LocaleSwitcher />
    </main>
  );
}
