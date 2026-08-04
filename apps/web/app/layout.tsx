import '@connected/ui/styles.css';
import './globals.css';

import { WebVitals } from '@/components/web-vitals';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'GetConnected',
  description: 'The school-community platform connecting students, parents, teachers, and schools.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Every page, including the unauthenticated ones — their load time is most of what a
            Core Web Vitals dashboard is for. */}
        <WebVitals />
      </body>
    </html>
  );
}
