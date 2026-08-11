import Link from 'next/link';

import { AuthForm, FormField } from '@/components/auth-form';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { getTranslations } from '@/lib/i18n/server';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('register.metaTitle') };
}

/**
 * Rendered per request, for the same reason as the landing page: the content security policy's
 * nonce is minted per response and prerendered HTML cannot carry it. Here it is not a nicety —
 * the form below is a client component, so a page that does not hydrate is a page nobody can
 * register on.
 */
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const { t } = await getTranslations();

  return (
    <main className="auth-shell">
      <div className="card auth-card">
        <h1>{t('register.title')}</h1>
        <p className="muted">{t('register.intro')}</p>

        <AuthForm
          action="/api/auth/register"
          submitLabel={t('register.submit')}
          pendingLabel={t('register.submitting')}
          redirectTo="/home"
        >
          <FormField name="fullName" label={t('register.fullName')} autoComplete="name" required />
          <FormField
            name="handle"
            label={t('register.handle')}
            autoComplete="username"
            required
            hint={t('register.handleHint')}
          />
          <FormField
            name="email"
            label={t('register.email')}
            type="email"
            autoComplete="email"
            required
          />
          <FormField
            name="password"
            label={t('register.password')}
            type="password"
            autoComplete="new-password"
            required
            hint={t('register.passwordHint')}
          />
        </AuthForm>

        <p className="muted">
          {t('register.haveAccount')} <Link href="/login">{t('register.signIn')}</Link>.
        </p>

        <LocaleSwitcher />
      </div>
    </main>
  );
}
