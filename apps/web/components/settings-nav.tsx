'use client';

/**
 * The four settings pages, as a navigable set.
 *
 * A `<nav>` with its own accessible name rather than a row of links: there is already a "Main"
 * navigation on the page, and two unnamed landmarks of the same type are indistinguishable to
 * anyone moving between them by landmark.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/security', label: 'Security' },
  { href: '/settings/privacy', label: 'Your data' },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings">
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 0 var(--ui-space-4)',
          display: 'flex',
          // Wraps, because four labels do not fit across a 320px screen and a non-wrapping flex
          // row inside a wrapping container is exactly the 69px overflow S9-17 found.
          flexWrap: 'wrap',
          gap: 'var(--ui-space-3)',
        }}
      >
        {TABS.map((tab) => (
          <li key={tab.href}>
            <Link href={tab.href} aria-current={pathname === tab.href ? 'page' : undefined}>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
