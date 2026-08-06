/**
 * Public landing page. No session and no personalization, so it was prerendered at build time
 * (`.docs/Architecture/03-frontend-architecture.md`).
 *
 * It is now rendered per request instead, and the reason is the content security policy: the nonce
 * that permits Next's own scripts is minted per response, and HTML built once at build time cannot
 * carry it. A prerendered page under this policy loads its markup and then hydrates nothing.
 *
 * What that costs here is the prerender, not the SEO — a crawler is served the same complete HTML
 * either way, and this page has nothing to fetch before it can be sent.
 */
import { Card } from '@connected/ui';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function LandingPage() {
  return (
    <main>
      <h1>GetConnected</h1>
      <p className="muted">
        The school-community platform connecting students, parents, teachers, and schools.
      </p>

      <Card>
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Get started</h2>
        <p>
          <Link href="/login">Sign in</Link> or <Link href="/register">create an account</Link>.
        </p>
        <p className="muted" style={{ fontSize: 'var(--ui-text-sm)', marginBottom: 0 }}>
          Schools use the web portal. Students, parents, and teachers can use the web or the mobile
          app.
        </p>
      </Card>
    </main>
  );
}
