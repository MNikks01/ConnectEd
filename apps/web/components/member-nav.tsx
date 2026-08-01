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
  { href: '/notifications', label: 'Notifications' },
];

export function MemberNav({ name, unreadCount }: { name: string; unreadCount: number }) {
  const pathname = usePathname();

  return (
    <div className="school-nav">
      <div className="school-nav__brand">
        <span className="school-nav__name">{name}</span>
        <span className="muted school-nav__role">GetConnected</span>
      </div>

      <nav aria-label="Main">
        <ul className="school-nav__list">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
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
