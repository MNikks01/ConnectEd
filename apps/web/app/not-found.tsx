/**
 * The page for an address that does not exist.
 *
 * It exists to be rendered per request rather than prerendered, for the reason given on the
 * landing page: the content security policy's nonce is minted per response, and HTML built once at
 * build time cannot carry it, so a prerendered 404 hydrates nothing — which on this app means the
 * web-vitals reporter in the root layout never runs for a route somebody could not reach.
 *
 * Kept deliberately plain, and it says "404" in as many words on purpose. Three specs — class
 * feeds, syllabus, timetable — look for that string as the sign that the portal refused somebody
 * who guessed a URL, rather than explaining what they had found. Reword this and they fail, which
 * is the correct outcome: what they are really asserting is that an outsider learns nothing.
 */
import Link from 'next/link';
import { getTranslations } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function NotFound() {
  const { t } = await getTranslations();

  return (
    <main>
      <h1>{t('errorPages.notFoundTitle')}</h1>
      <p className="muted">{t('errorPages.notFoundBody')}</p>
      <p>
        <Link href="/">{t('errorPages.backToStart')}</Link>
      </p>
    </main>
  );
}
