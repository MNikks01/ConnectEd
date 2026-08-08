'use client';

/**
 * Portal navigation.
 *
 * `aria-current="page"` rather than styling alone — a screen reader announces which section is
 * active, which a colour change does not convey.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LogoutButton } from './logout-button';

const LINKS = [
  { href: '/school', label: 'Profile' },
  { href: '/school/classes', label: 'Classes' },
  { href: '/school/terms', label: 'Terms' },
  { href: '/school/notices', label: 'Notices' },
  { href: '/school/events', label: 'Events' },
  { href: '/school/complaints', label: 'Complaints' },
  { href: '/school/members', label: 'Members' },
  { href: '/school/verifications', label: 'Verifications' },
  { href: '/school/analytics', label: 'Analytics' },
  { href: '/school/billing', label: 'Billing' },
];

export function SchoolNav({ schoolName }: { schoolName: string }) {
  const pathname = usePathname();

  return (
    <div className="school-nav">
      <div className="school-nav__brand">
        <span className="school-nav__name">{schoolName}</span>
        <span className="muted school-nav__role">School portal</span>
      </div>

      <nav aria-label="School portal">
        <ul className="school-nav__list">
          {LINKS.map((link) => {
            // `/school` would otherwise match every child route.
            const active =
              link.href === '/school' ? pathname === link.href : pathname.startsWith(link.href);

            return (
              <li key={link.href}>
                <Link href={link.href} aria-current={active ? 'page' : undefined}>
                  {link.label}
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
