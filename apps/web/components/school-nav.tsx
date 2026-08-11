'use client';

/**
 * Portal navigation.
 *
 * `aria-current="page"` rather than styling alone — a screen reader announces which section is
 * active, which a colour change does not convey.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useTranslations } from './locale-provider';
import { LogoutButton } from './logout-button';

import type { MessageKey } from '@/lib/i18n/translate';

const LINKS: { href: string; label: MessageKey }[] = [
  { href: '/school', label: 'schoolNav.profile' },
  { href: '/school/classes', label: 'schoolNav.classes' },
  { href: '/school/terms', label: 'schoolNav.terms' },
  { href: '/school/notices', label: 'schoolNav.notices' },
  { href: '/school/events', label: 'schoolNav.events' },
  { href: '/school/complaints', label: 'schoolNav.complaints' },
  { href: '/school/members', label: 'schoolNav.members' },
  { href: '/school/verifications', label: 'schoolNav.verifications' },
  { href: '/school/analytics', label: 'schoolNav.analytics' },
  { href: '/school/billing', label: 'schoolNav.billing' },
  // A school exports its own record too (FR-DSR-012). The page itself lives in the member shell,
  // which schools are deliberately not redirected away from — but nothing in this portal linked to
  // it, and a subject right reachable only by typing a URL is not one.
  { href: '/settings/privacy', label: 'schoolNav.yourData' },
];

export function SchoolNav({ schoolName }: { schoolName: string }) {
  const { t } = useTranslations();
  const pathname = usePathname();

  return (
    <div className="school-nav">
      <div className="school-nav__brand">
        <span className="school-nav__name">{schoolName}</span>
        <span className="muted school-nav__role">{t('schoolNav.portal')}</span>
      </div>

      <nav aria-label={t('schoolNav.navLabel')}>
        <ul className="school-nav__list">
          {LINKS.map((link) => {
            // `/school` would otherwise match every child route.
            const active =
              link.href === '/school' ? pathname === link.href : pathname.startsWith(link.href);

            return (
              <li key={link.href}>
                <Link href={link.href} aria-current={active ? 'page' : undefined}>
                  {t(link.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <LogoutButton />
    </div>
  );
}
