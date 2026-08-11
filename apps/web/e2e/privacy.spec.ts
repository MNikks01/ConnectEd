/**
 * Export and erasure, driven by a browser — S9-19 (`.docs/PRD/14-export-and-erasure.md`).
 *
 * The API suite proves the rules and the disposition. What only a browser can prove is that a
 * person can **find and use** these two rights — which is the whole difference between a right and
 * a favour, and the reason S7-7's lesson ("every check green while the product has no way in") gets
 * cited here rather than in the integration tests.
 *
 * **The build itself is deliberately not asserted from a browser.** An export is built by a job the
 * worker runs on a schedule, so a browser test would have to wait out a cron tick to see `READY` —
 * a minute of sleeping in exchange for re-proving what twenty integration tests already hold. What
 * is asserted here is the half a person actually sees: the request is accepted and the page says
 * so, honestly, without claiming the file exists yet.
 */
import { expect, test } from '@playwright/test';

import { createIndividual, createSchool } from './support/accounts';
import { signIn } from './support/auth';

test.describe('your data', () => {
  test('a person can find both rights, and reach them from the nav', async ({ page }) => {
    const person = await createIndividual('privacy');

    await signIn(page, person.email);
    await page.goto('/settings/notifications');

    // Reachable by clicking, not only by typing a URL. Until this page existed, /settings/security
    // and /settings/profile had no link anywhere in the product.
    await page
      .getByRole('navigation', { name: 'Settings' })
      .getByRole('link', { name: 'Your data' })
      .click();

    // `level: 1` rather than the name alone: "Download your data" is an h2 on the same page and
    // an unqualified name match resolves to both.
    await expect(page.getByRole('heading', { name: 'Your data', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Download your data' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Delete your account' })).toBeVisible();

    await expect(page.getByText('You have not asked for a copy before')).toBeVisible();
  });

  test('requesting a copy says it is being prepared, and not that it is done', async ({ page }) => {
    const person = await createIndividual('export');

    await signIn(page, person.email);
    await page.goto('/settings/privacy');

    await page.getByRole('button', { name: 'Request a copy' }).click();

    // Asserted on the state the server now reports, not on the transient confirmation — a
    // revalidation can destroy the message a browser test was waiting for, which this suite has
    // been caught by before.
    await expect(page.getByText('Being prepared')).toBeVisible();

    // And the second request is refused by the button being unavailable rather than by an error
    // after the fact: two bundles of one person is one more copy than anybody asked for.
    await expect(page.getByRole('button', { name: 'Request a copy' })).toBeDisabled();
  });

  test('erasure is typed, scheduled, and can be stopped', async ({ page }) => {
    const person = await createIndividual('erasure');

    await signIn(page, person.email);
    await page.goto('/settings/privacy');

    // The one irreversible action in the product is not a single click.
    const schedule = page.getByRole('button', { name: 'Schedule deletion' });
    await expect(schedule).toBeDisabled();

    await page.getByLabel('Type ERASE to confirm').fill('ERASE');
    await expect(schedule).toBeEnabled();
    await schedule.click();

    // The grace period, in words, with the way out next to it (FR-DSR-021, FR-DSR-022).
    await expect(page.getByText(/scheduled for deletion on/i)).toBeVisible();

    const keep = page.getByRole('button', { name: 'Keep my account' });
    await expect(keep).toBeVisible();

    // Nothing is taken away during the grace period — the change of mind is the point of it.
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();

    await keep.click();

    await expect(page.getByRole('button', { name: 'Schedule deletion' })).toBeVisible();
    await expect(page.getByText(/scheduled for deletion on/i)).toHaveCount(0);
  });

  test('a school is told why it cannot delete itself, not merely refused', async ({ page }) => {
    const school = await createSchool('privacy');

    await signIn(page, school.email);
    await page.goto('/settings/privacy');

    // It still exports — the institution's own record (FR-DSR-012).
    await expect(page.getByRole('button', { name: 'Request a copy' })).toBeEnabled();

    // A bare absence reads as a missing feature, so the page explains rather than hides.
    await expect(page.getByText(/belong to its pupils and their families/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schedule deletion' })).toHaveCount(0);
  });
});
