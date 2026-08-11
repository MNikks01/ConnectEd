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

import { useTranslations } from './locale-provider';

import type { MessageKey } from '@/lib/i18n/translate';

const TABS: { href: string; label: MessageKey }[] = [
  { href: '/settings/profile', label: 'settings.profile' },
  { href: '/settings/notifications', label: 'settings.notifications' },
  { href: '/settings/security', label: 'settings.security' },
  { href: '/settings/privacy', label: 'settings.privacy' },
];

export function SettingsNav() {
  const { t } = useTranslations();
  const pathname = usePathname();

  return (
    <nav aria-label={t('settings.nav')}>
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
              {t(tab.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
