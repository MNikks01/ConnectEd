'use client';

/**
 * Member navigation, including the notification bell (FR-NOTIF-002).
 *
 * The count is in the link's accessible name, not only in a coloured pill — "Notifications, 3
 * unread" is what a screen reader should say, and a bare "3" next to a bell icon says nothing.
 * The pill itself is `aria-hidden` so the number is not announced twice.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useTranslations } from './locale-provider';
import { LogoutButton } from './logout-button';

import type { MessageKey } from '@/lib/i18n/translate';

/**
 * The label is a key, not a word. Everything else about the list — order, hrefs, the bell — is the
 * same in every language; only the rendering changes, and it changes in one place below.
 */
const LINKS: { href: string; label: MessageKey }[] = [
  { href: '/home', label: 'nav.home' },
  { href: '/notices', label: 'nav.notices' },
  { href: '/events', label: 'nav.events' },
  { href: '/leave', label: 'nav.leave' },
  { href: '/complaints', label: 'nav.complaints' },
  { href: '/social', label: 'nav.social' },
  { href: '/messages', label: 'nav.messages' },
  { href: '/notifications', label: 'nav.notifications' },
  { href: '/settings/notifications', label: 'nav.settings' },
];

export function MemberNav({
  name,
  unreadCount,
  isPlatformAdmin = false,
}: {
  name: string;
  unreadCount: number;
  /** ConnectEd staff (ADR-0017). Adds one link; the API authorizes every call independently. */
  isPlatformAdmin?: boolean;
}) {
  const { t } = useTranslations();
  const pathname = usePathname();

  // Appended rather than woven in: the console is a staff tool that happens to be reached from a
  // member session, and putting it between Social and Messages would suggest it is part of the
  // product a school bought.
  const links = isPlatformAdmin
    ? [...LINKS, { href: '/admin/reports', label: 'nav.reports' as MessageKey }]
    : LINKS;

  return (
    <div className="school-nav">
      <div className="school-nav__brand">
        <span className="school-nav__name">{name}</span>
        <span className="muted school-nav__role">GetConnected</span>
      </div>

      <nav aria-label={t('nav.main')}>
        <ul className="school-nav__list">
          {links.map((link) => {
            // Settings is a set of pages under one link, so the tab stays current on all of
            // them rather than only on the one the link happens to point at.
            const section = link.href.startsWith('/settings') ? '/settings' : link.href;
            const active = pathname === section || pathname.startsWith(`${section}/`);
            const bell = link.href === '/notifications';
            const text = t(link.label);
            // Interpolated from the catalogue rather than concatenated: word order is not universal,
            // and "3 unread, Notifications" is the correct order in some languages.
            const label =
              bell && unreadCount > 0 ? t('nav.unread', { label: text, count: unreadCount }) : text;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={label}
                >
                  {text}
                  {bell && unreadCount > 0 ? (
                    <span className="badge-count" aria-hidden="true">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
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
