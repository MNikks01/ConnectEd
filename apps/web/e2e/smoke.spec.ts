/**
 * The smoke test: does a **deployed** ConnectEd work at all.
 *
 * Deliberately not part of the end-to-end suite, and run by `smoke.config.ts` against a stack that
 * is already running — the compose file today (S9-2), a staging deployment tomorrow (S9-4, S9-5).
 * The E2E suite starts its own servers from source and proves the product's rules; this proves the
 * thing that was *deployed* is wired to a database, a queue and an object store that exist.
 *
 * It is short on purpose. A smoke test that covers a lot takes long enough that somebody will be
 * tempted to run it after the deploy rather than as part of it, and one that reports afterwards is
 * a monitor, not a gate.
 *
 * What it touches, and why each is not redundant:
 *
 * - **Registration** — writes to Postgres and creates a trial subscription in the same statement.
 * - **Sign-in through the form** — proves the session cookie survives the round trip, which is the
 *   one thing no server test can tell you and the first thing a reverse proxy breaks.
 * - **A class** — an authorized write, so the token the browser is holding is one the API accepts.
 */
import { expect, test } from '@playwright/test';

import { createSchool } from './support/accounts';
import { signIn } from './support/auth';

test('a deployed ConnectEd can register a school, sign it in, and take a write', async ({
  page,
}) => {
  const school = await createSchool('smoke');

  await signIn(page, school.email);

  await page.goto('/school/classes');
  await page.getByLabel('Medium').selectOption('ENGLISH');
  await page.getByLabel('Level').selectOption('CLASS_5');
  await page.getByLabel('Section').selectOption('A');
  await page.getByRole('button', { name: 'Add class' }).click();

  // Reload before asserting, as the portal suite does: the write returning and the list
  // re-rendering are two different things, and on a loaded machine only the second is a race.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('link', { name: 'Class 5-A (English)' })).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 20000 });
});
