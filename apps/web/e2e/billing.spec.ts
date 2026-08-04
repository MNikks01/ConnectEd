/**
 * Billing in the school portal — S5-7 (`PRD/08-billing.md`).
 *
 * The chain worth walking in a browser is the one that spans registration, the trial created with
 * the school, the limit enforced at a write, and the message a person actually reads when they are
 * stopped. Nothing below the browser can assert that a school registered thirty seconds ago sees a
 * plan it never asked for and is told when it runs out.
 */
import { expect, test } from '@playwright/test';

import { createIndividual, createSchool } from './support/accounts';
import { signIn } from './support/auth';

test.describe('the billing page', () => {
  test('a newly registered school is already on a trial', async ({ page }) => {
    const school = await createSchool('billing');
    await signIn(page, school.email);

    await page.goto('/school/billing');

    // Nobody granted this. It was created in the same statement as the school (FR-BILL-001).
    await expect(page.getByRole('heading', { name: 'Trial' })).toBeVisible();
    await expect(page.getByText(/Your trial runs until/)).toBeVisible();
    await expect(page.getByText(/Everything you have already created stays/)).toBeVisible();
  });

  test('shows usage against each limit, and says what a limit does not do', async ({ page }) => {
    const school = await createSchool('usage');
    await signIn(page, school.email);

    await page.goto('/school/billing');

    // A brand-new school: no classes, and no members until someone is verified.
    await expect(page.getByText('Classes — 0 of 5')).toBeVisible();
    await expect(page.getByText('Members — 0 of 200')).toBeVisible();
    await expect(page.getByText(/never removes or hides anything you already have/)).toBeVisible();
  });

  test('offers no upgrade button while there is nothing behind it', async ({ page }) => {
    const school = await createSchool('upgrade');
    await signIn(page, school.email);

    await page.goto('/school/billing');

    // Checkout waits on the provider decision. A control that looks live and does nothing is
    // worse than its absence, especially where someone is trying to pay.
    await expect(page.getByText('Self-service upgrades are not available yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: /upgrade/i })).toHaveCount(0);
  });

  test('is not offered to an individual', async ({ page }) => {
    const person = await createIndividual('nobilling');
    await signIn(page, person.email);

    await page.goto('/school/billing');

    // The portal is school-only; the API refuses the read independently.
    await expect(page).toHaveURL('/home');
  });
});

test.describe('reaching a limit', () => {
  test('the school is told what stopped it, and keeps everything it has', async ({ page }) => {
    const school = await createSchool('limit');
    await signIn(page, school.email);

    // The trial allows five classes. Fill it.
    const sections = ['A', 'B', 'C', 'D', 'E'];
    for (const section of sections) {
      await page.goto('/school/classes');
      await page.getByLabel('Medium').selectOption('ENGLISH');
      await page.getByLabel('Level').selectOption('CLASS_8');
      await page.getByLabel('Section').selectOption(section);
      await page.getByRole('button', { name: 'Add class' }).click();
      await expect(page.getByText('Class added.')).toBeVisible();
    }

    await page.goto('/school/billing');
    await expect(page.getByText('Classes — 5 of 5 · full')).toBeVisible();

    // The sixth is refused, and the refusal explains itself rather than hiding behind a 404.
    // A different level, because sections run A–E and the point is the plan limit, not the taxonomy.
    await page.goto('/school/classes');
    await page.getByLabel('Medium').selectOption('ENGLISH');
    await page.getByLabel('Level').selectOption('CLASS_9');
    await page.getByLabel('Section').selectOption('A');
    await page.getByRole('button', { name: 'Add class' }).click();

    await expect(page.getByText(/allows 5 classes, and 5 are in use/)).toBeVisible();
    await expect(page.getByText(/nothing you already have is affected/)).toBeVisible();

    // And it is true: the five are still there and still administrable.
    await page.reload();
    for (const section of sections) {
      await expect(page.getByText(`Class 8-${section} (English)`).first()).toBeVisible();
    }
  });
});

test.describe('analytics', () => {
  test('a school on the trial is told what would unlock it, not shown a wall', async ({ page }) => {
    const school = await createSchool('analytics');
    await signIn(page, school.email);

    await page.goto('/school/analytics');

    // The state almost every school is in, because checkout does not exist yet. It has to read as
    // the product working as sold rather than as a broken page.
    await expect(page.getByRole('heading', { name: 'Not on your plan yet' })).toBeVisible();
    await expect(page.getByText(/does not include advanced analytics/)).toBeVisible();
    await expect(page.getByText(/part of the Premium plan/)).toBeVisible();

    // Somewhere to go, rather than a button that would do nothing.
    await page.getByRole('link', { name: 'See your plan' }).click();
    await expect(page).toHaveURL('/school/billing');
  });

  test('is reachable from the portal navigation', async ({ page }) => {
    const school = await createSchool('analytics-nav');
    await signIn(page, school.email);

    await page.goto('/school');
    await page.getByRole('link', { name: 'Analytics' }).click();

    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('is not offered to an individual', async ({ page }) => {
    const person = await createIndividual('noanalytics');
    await signIn(page, person.email);

    await page.goto('/school/analytics');

    await expect(page).toHaveURL('/home');
  });
});
