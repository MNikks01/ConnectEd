/**
 * Public landing page. Static by default — no session, no personalization, so it prerenders and
 * stays SEO-friendly (`.docs/Architecture/03-frontend-architecture.md`).
 */
import { Card } from '@connected/ui';
import Link from 'next/link';

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
