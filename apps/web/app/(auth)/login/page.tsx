import Link from 'next/link';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { LoginForm } from '@/components/login-form';
import { getTranslations } from '@/lib/i18n/server';

import type { Metadata } from 'next';

/**
 * The tab title is generated per request so it follows the locale too — a page whose body is Hindi
 * and whose tab says "Sign in" is half-translated in the one place a person keeps looking.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('login.metaTitle') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  const { t } = await getTranslations();

  return (
    <main className="auth-shell">
      <div className="card auth-card">
        <h1>{t('login.title')}</h1>
        <p className="muted">{t('login.welcome')}</p>

        {expired ? (
          <p className="form-error" role="status">
            {t('login.sessionExpired')}
          </p>
        ) : null}

        <LoginForm />

        <p className="muted">
          {t('login.noAccount')} <Link href="/register">{t('login.createOne')}</Link>.
        </p>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          {t('login.schoolWebOnly')}
        </p>

        <LocaleSwitcher />
      </div>
    </main>
  );
}
