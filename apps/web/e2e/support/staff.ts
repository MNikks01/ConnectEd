/**
 * Making somebody ConnectEd staff, the only way the product supports (ADR-0017).
 *
 * There is deliberately no endpoint, so this shells out to the same script an operator would run.
 * That is the point of testing it this way: the documented onboarding path is the one thing here
 * nobody would otherwise ever verify, and a console reachable only by a grant nobody can perform
 * is not reachable at all.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://connected:connected@localhost:5432/connected_e2e?schema=public';

export function grantPlatformAdmin(email: string): void {
  execFileSync('pnpm', ['--filter', '@connected/api', 'admin:grant', email], {
    // Playwright transpiles specs to CommonJS, so `import.meta` is not available here.
    cwd: resolve(dirname(__filename), '../../../..'),
    env: { ...process.env, DATABASE_URL },
    stdio: 'pipe',
  });
}
