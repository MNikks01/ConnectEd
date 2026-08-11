import '@connected/ui/styles.css';
import './globals.css';

import { LocaleProvider } from '@/components/locale-provider';
import { WebVitals } from '@/components/web-vitals';
import { getLocale, messagesFor } from '@/lib/i18n/server';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'GetConnected',
  description: 'The school-community platform connecting students, parents, teachers, and schools.',
};

/**
 * Reading the locale cookie makes this layout dynamic, which costs nothing here: the content
 * security policy already forces every page to be rendered per request, because the nonce that
 * permits Next's own scripts is minted per response.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    // `lang` is not decoration. It is what tells a screen reader which voice to use, and Hindi read
    // aloud by an English synthesiser is not "accented", it is unintelligible.
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale} messages={messagesFor(locale)}>
          {children}
        </LocaleProvider>
        {/* Every page, including the unauthenticated ones — their load time is most of what a
            Core Web Vitals dashboard is for. */}
        <WebVitals />
      </body>
    </html>
  );
}
