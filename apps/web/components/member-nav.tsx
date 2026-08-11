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

import { LogoutButton } from './logout-button';

const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/notices', label: 'Notices' },
  { href: '/events', label: 'Events' },
  { href: '/leave', label: 'Leave' },
  { href: '/complaints', label: 'Complaints' },
  { href: '/social', label: 'Social' },
  { href: '/messages', label: 'Messages' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/settings/notifications', label: 'Settings' },
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
  const pathname = usePathname();

  // Appended rather than woven in: the console is a staff tool that happens to be reached from a
  // member session, and putting it between Social and Messages would suggest it is part of the
  // product a school bought.
  const links = isPlatformAdmin ? [...LINKS, { href: '/admin/reports', label: 'Reports' }] : LINKS;

  return (
    <div className="school-nav">
      <div className="school-nav__brand">
        <span className="school-nav__name">{name}</span>
        <span className="muted school-nav__role">GetConnected</span>
      </div>

      <nav aria-label="Main">
        <ul className="school-nav__list">
          {links.map((link) => {
            // Settings is a set of pages under one link, so the tab stays current on all of
            // them rather than only on the one the link happens to point at.
            const section = link.href.startsWith('/settings') ? '/settings' : link.href;
            const active = pathname === section || pathname.startsWith(`${section}/`);
            const bell = link.href === '/notifications';
            const label =
              bell && unreadCount > 0 ? `${link.label}, ${unreadCount} unread` : link.label;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={label}
                >
                  {link.label}
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
