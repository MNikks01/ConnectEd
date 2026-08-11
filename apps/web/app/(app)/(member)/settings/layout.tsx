/**
 * Settings shell.
 *
 * Added with the privacy page, and it fixes something older: `/settings/profile` and
 * `/settings/security` had existed since Sprints 4 and 6 with **nothing in the product linking to
 * them** — reachable only by typing the URL. A subject right that can only be found that way is not
 * a right, it is a favour, so the tabs arrived at the same time as the page that made it obvious.
 */
import { SettingsNav } from '@/components/settings-nav';

import type { ReactNode } from 'react';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SettingsNav />
      {children}
    </>
  );
}
