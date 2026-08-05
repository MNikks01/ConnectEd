/**
 * The headers the browser is sent, and whether the app still works under them.
 *
 * Both halves matter and they pull against each other. A policy nobody checks drifts into
 * permitting everything; a policy nobody exercises breaks the product in a way unit tests cannot
 * see, because the thing that breaks is a browser refusing to run a script that a server was
 * perfectly happy to send.
 *
 * So these tests assert the header, and then assert that a real Chrome loaded the page, ran Next's
 * inline bootstrap, and reported no violation while doing it. `window.__next_f` is the proof of the
 * first: it is pushed to by the inline script the nonce exists to permit, so if the nonce were
 * missing or wrong, it would be undefined — which is exactly what a prerendered page produced
 * before the routes that were static were made per-request.
 *
 * See `.docs/Security/05-review-2026-08-05.md`, finding 1.
 */
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

import { createSchool, verifiedStudentIn, createClass } from './support/accounts';
import { signIn } from './support/auth';

/** Directives that must survive any future edit to the policy. */
const REQUIRED = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "default-src 'self'",
];

function cspViolations(page: Page): string[] {
  const seen: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) seen.push(message.text());
  });
  return seen;
}

/** True when Next's inline bootstrap ran — i.e. the nonce reached the script tag. */
async function hydrated(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    Array.isArray((window as unknown as { __next_f?: unknown[] }).__next_f),
  );
}

test.describe('what the server sends', () => {
  test('sets a policy and the headers that go with it', async ({ request }) => {
    const response = await request.get('/login');
    const headers = response.headers();

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');

    const policy = headers['content-security-policy'] ?? '';
    for (const directive of REQUIRED) expect(policy).toContain(directive);

    // The script policy is a nonce, not a blanket permission. `'unsafe-inline'` here would make
    // every other line of it decorative.
    expect(policy).toMatch(/script-src [^;]*'nonce-[^']+'/);
    expect(policy).toMatch(/script-src [^;]*'strict-dynamic'/);
    expect(policy).not.toMatch(/script-src [^;]*'unsafe-inline'/);
    expect(policy).not.toMatch(/script-src [^;]*'unsafe-eval'/);
  });

  test('mints a new nonce for every response', async ({ request }) => {
    const nonces = await Promise.all(
      [1, 2, 3].map(async () => {
        const policy = (await request.get('/login')).headers()['content-security-policy'] ?? '';
        return /'nonce-([^']+)'/.exec(policy)?.[1];
      }),
    );

    // A nonce reused across responses is a nonce an attacker can read off one page and reuse on
    // the next, which is the same as not having one.
    expect(new Set(nonces).size).toBe(3);
    expect(nonces.every((nonce) => (nonce?.length ?? 0) >= 16)).toBe(true);
  });

  test('sends the headers on route handlers too', async ({ request }) => {
    // These answer the browser directly, and a 401 body is still a response somebody could frame.
    const response = await request.post('/api/realtime/ticket', { failOnStatusCode: false });

    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  });
});

test.describe('the app under the policy', () => {
  // The three routes that were prerendered before this policy existed, and so are the ones a
  // regression would break first: static HTML cannot carry a per-response nonce.
  for (const path of ['/', '/register', '/login']) {
    test(`${path} runs its scripts and reports nothing`, async ({ page }) => {
      const violations = cspViolations(page);

      await page.goto(path);

      expect(await hydrated(page)).toBe(true);
      expect(violations).toEqual([]);
    });
  }

  test('an address that does not exist still hydrates', async ({ page }) => {
    const violations = cspViolations(page);

    const response = await page.goto('/this-page-does-not-exist');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    expect(await hydrated(page)).toBe(true);
    expect(violations).toEqual([]);
  });

  test('a signed-in page works end to end without a violation', async ({ page }) => {
    const school = await createSchool('csp');
    const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_5', section: 'C' });
    const student = await verifiedStudentIn(school, klass.id);

    const violations = cspViolations(page);

    // The whole authenticated path in one go: a form posting to a route handler, a redirect, a
    // dashboard assembled from several authorized reads, and then `/messages`, which mounts the
    // island that opens the realtime socket — the one thing in this app that connects anywhere
    // other than its own origin, and so the one `connect-src` could quietly break.
    await signIn(page, student.email);
    await page.goto('/messages');
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
    // Long enough for the ticket to be fetched and the socket to be opened or refused.
    await page.waitForTimeout(2000);

    expect(await hydrated(page)).toBe(true);
    expect(violations).toEqual([]);
  });

  test('refuses to be framed', async ({ page }) => {
    const violations = cspViolations(page);

    // `frame-ancestors` is enforced by the framing browser, so this is the only way to see it:
    // put the app in an iframe on another page and check nothing rendered inside it.
    await page.setContent(
      `<iframe id="framed" src="${test.info().project.use.baseURL ?? ''}/login"></iframe>`,
    );

    // Polled rather than slept on: the refusal is logged when the browser gets the response, and
    // how long that takes is not this test's business.
    await expect
      .poll(() => violations.join(' '), { timeout: 10_000 })
      .toMatch(/frame-ancestors|Refused to (display|frame)/i);

    const framedText = await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#framed');
      try {
        return frame?.contentDocument?.body?.textContent ?? null;
      } catch {
        // A cross-origin document would throw; a refused one gives an empty same-origin document.
        return null;
      }
    });

    expect(framedText ?? '').not.toContain('Sign in');
  });
});
