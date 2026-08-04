/**
 * The moderation console — S6-6 (ADR-0017).
 *
 * The chain worth walking in a browser is the one that spans a child reporting something and a
 * member of staff acting on it: two people, two sessions, and a grant performed the way an
 * operator would actually perform it.
 */
import { expect, test } from '@playwright/test';

import { createIndividual } from './support/accounts';
import { signIn } from './support/auth';
import { grantPlatformAdmin } from './support/staff';

/**
 * The E2E database is never truncated — deliberately, because doing it from the test process while
 * the servers hold connections is a source of lock contention. So the queue fills with every
 * previous run's reports, and a test has to find *its own* by a string nothing else uses.
 */
let unique = 0;
function marker(prefix: string): string {
  unique += 1;
  return `${prefix}-${Date.now()}-${String(unique)}`;
}

test.describe('the moderation console', () => {
  test('is invisible to anyone who is not staff', async ({ page }) => {
    const person = await createIndividual('notstaff');
    await signIn(page, person.email);

    await page.goto('/home');
    // Not merely disabled — absent. An ordinary account should not learn the console exists.
    await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);

    await page.goto('/admin/reports');
    await expect(page).toHaveURL('/home');
  });

  test('a reported post reaches staff, who remove it', async ({ browser }) => {
    const author = await createIndividual('modauthor');
    const reporter = await createIndividual('modreporter');
    const staff = await createIndividual('modstaff');
    grantPlatformAdmin(staff.email);

    const postBody = `Something a child should not read ${marker('post')}`;
    const reason = `Not appropriate ${marker('reason')}`;

    const authorContext = await browser.newContext();
    const reporterContext = await browser.newContext();
    const staffContext = await browser.newContext();
    const authorPage = await authorContext.newPage();
    const reporterPage = await reporterContext.newPage();
    const staffPage = await staffContext.newPage();

    try {
      // Somebody posts something.
      await signIn(authorPage, author.email);
      await authorPage.goto('/social');
      await authorPage.getByLabel('Say something').fill(postBody);
      await authorPage.getByRole('button', { name: 'Post' }).click();
      await expect(authorPage.getByText('Posted.')).toBeVisible();

      // Somebody else reports it.
      await signIn(reporterPage, reporter.email);
      await reporterPage.goto(`/accounts/${author.accountId}`);
      await reporterPage.getByRole('article').getByRole('button', { name: 'Report' }).click();
      await reporterPage.getByLabel('What is wrong with this?').fill(reason);
      await reporterPage.getByRole('button', { name: 'Send report' }).click();
      await expect(reporterPage.getByText('Nobody at your school is told.')).toBeVisible();

      // Staff read it. This is the part that did not exist until S6-6.
      await signIn(staffPage, staff.email);
      await staffPage.goto('/admin/reports');

      const card = staffPage.getByRole('article').filter({ hasText: reason });
      await expect(card).toBeVisible();
      await expect(card.getByText(postBody)).toBeVisible();

      // And the reporter is not named anywhere on the page.
      await expect(staffPage.getByText(reporter.fullName)).toHaveCount(0);

      await card.getByRole('link', { name: 'Review this' }).click();
      await staffPage.getByLabel('Decision').selectOption('ACTIONED');
      await staffPage.getByLabel('Note').fill('Removed on review.');
      await staffPage.getByRole('button', { name: 'Record decision' }).click();
      await expect(staffPage.getByText('Recorded.')).toBeVisible();

      // The claim the whole queue rests on: the post is actually gone.
      await authorPage.goto('/social');
      await expect(authorPage.getByText(postBody)).toBeHidden();
    } finally {
      await authorContext.close();
      await reporterContext.close();
      await staffContext.close();
    }
  });

  test('offers no removal for a report about an account', async ({ browser }) => {
    const subject = await createIndividual('modsubject');
    const reporter = await createIndividual('modreporter2');
    const staff = await createIndividual('modstaff2');
    grantPlatformAdmin(staff.email);

    const reason = `Impersonating a teacher ${marker('reason')}`;

    const reporterContext = await browser.newContext();
    const staffContext = await browser.newContext();
    const reporterPage = await reporterContext.newPage();
    const staffPage = await staffContext.newPage();

    try {
      await signIn(reporterPage, reporter.email);
      await reporterPage.goto(`/accounts/${subject.accountId}`);
      await reporterPage.getByRole('button', { name: 'Report' }).first().click();
      // "What is wrong?" is the profile-level form; a post's asks "What is wrong with this?".
      // They are deliberately different questions, and the suite has caught this before.
      await reporterPage.getByLabel('What is wrong?').fill(reason);
      await reporterPage.getByRole('button', { name: 'Send report' }).click();

      await signIn(staffPage, staff.email);
      await staffPage.goto('/admin/reports');
      await staffPage
        .getByRole('article')
        .filter({ hasText: reason })
        .getByRole('link', { name: 'Review this' })
        .click();

      // A control that would fail is worse than an absent one: it teaches a reviewer that the
      // button is decorative. Suspending an account is not a queue action.
      await expect(staffPage.getByText(/cannot be removed from here/)).toBeVisible();
      await expect(staffPage.getByLabel('Decision')).not.toHaveValue('ACTIONED');
    } finally {
      await reporterContext.close();
      await staffContext.close();
    }
  });
});
