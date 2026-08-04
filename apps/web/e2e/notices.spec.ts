/**
 * Notices and events, driven by a browser (S2-5).
 *
 * The school writes, the whole community reads. The negative that matters here is different from
 * the class feed's: a *verified member* of the school may read every notice and publish none of
 * them, and the portal must not offer them a control the API would refuse.
 */
import { expect, test } from '@playwright/test';

import { createClass, createSchool, verifiedStudentIn, type School } from './support/accounts';
import { signIn } from './support/auth';
import { clickUntil } from './support/interactions';

async function schoolWithClass(section: string): Promise<{ school: School; classId: string }> {
  const school = await createSchool('notice');
  const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_9', section });
  return { school, classId: klass.id };
}

test.describe('notices', () => {
  test('a school publishes and its members read it', async ({ page }) => {
    const { school, classId } = await schoolWithClass('A');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, school.email);
    await page.goto('/school/notices');
    await expect(page.getByText('No notices yet.')).toBeVisible();

    await page.getByLabel('Title').fill('Sports day moved');
    await page.getByRole('textbox', { name: 'Notice' }).fill('It is now on the 14th, same time.');
    await page.getByRole('button', { name: 'Publish notice' }).click();

    await expect(page.getByText('Everyone at the school has been notified.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sports day moved' })).toBeVisible();
    await expect(page.getByText('read by 0')).toBeVisible();

    // Now the student.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);

    await page.getByRole('link', { name: 'Notices', exact: true }).click();
    await expect(page.getByText('Unread')).toBeVisible();

    await page.getByRole('link', { name: 'Sports day moved' }).click();
    await expect(page.getByText('It is now on the 14th, same time.')).toBeVisible();

    // Opening it is what marks it read.
    await page.goto('/notices');
    await expect(page.getByText('Unread')).toBeHidden();
  });

  test('a student is offered no way to publish one', async ({ page }) => {
    const { school, classId } = await schoolWithClass('B');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, student.email);
    await page.goto('/notices');

    await expect(page.getByRole('button', { name: 'Publish notice' })).toBeHidden();

    // And the portal that would offer it is closed to them entirely.
    await page.goto('/school/notices');
    await expect(page).toHaveURL('/home');
  });

  test('withdrawing asks first, and removes it from the member’s list', async ({ page }) => {
    const { school, classId } = await schoolWithClass('C');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, school.email);
    await page.goto('/school/notices');
    await page.getByLabel('Title').fill('Posted in error');
    await page.getByRole('textbox', { name: 'Notice' }).fill('Ignore this one.');
    await page.getByRole('button', { name: 'Publish notice' }).click();
    await expect(page.getByRole('heading', { name: 'Posted in error' })).toBeVisible();

    await page.getByRole('button', { name: 'Withdraw' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('disappears from every member');

    await clickUntil(dialog.getByRole('button', { name: 'Withdraw notice' }), async () => {
      await expect(page.getByText('No notices yet.')).toBeVisible({ timeout: 2000 });
    });

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);
    await page.goto('/notices');

    await expect(page.getByText('Nothing has been posted yet.')).toBeVisible();
  });

  test('a withdrawal that fails says so instead of closing quietly', async ({ browser }) => {
    const { school } = await schoolWithClass('E');

    // Two tabs, which is the ordinary shape of every real failure here: a stale page, a colleague,
    // a lost race. Before this was fixed the second tab's dialog closed on the error and the
    // notice stayed — indistinguishable, from the outside, from success.
    const first = await browser.newContext();
    const second = await browser.newContext();
    const tabA = await first.newPage();
    const tabB = await second.newPage();

    try {
      await signIn(tabA, school.email);
      await tabA.goto('/school/notices');
      await tabA.getByLabel('Title').fill('Withdrawn twice');
      await tabA.getByRole('textbox', { name: 'Notice' }).fill('Once is enough.');
      await tabA.getByRole('button', { name: 'Publish notice' }).click();
      await expect(tabA.getByRole('heading', { name: 'Withdrawn twice' })).toBeVisible();

      await signIn(tabB, school.email);
      await tabB.goto('/school/notices');
      await expect(tabB.getByRole('heading', { name: 'Withdrawn twice' })).toBeVisible();

      // The first tab withdraws it.
      await tabA.getByRole('button', { name: 'Withdraw' }).click();
      await clickUntil(
        tabA.getByRole('dialog').getByRole('button', { name: 'Withdraw notice' }),
        async () => {
          await expect(tabA.getByText('No notices yet.')).toBeVisible({ timeout: 2000 });
        },
      );

      // The second tab tries to withdraw what is already gone.
      await tabB.getByRole('button', { name: 'Withdraw' }).click();
      const dialog = tabB.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Withdraw notice' }).click();

      // The dialog stays, and says something. A confirmation that closes on failure teaches the
      // school that it worked, and the notice is still on every member's list.
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('alert')).toBeVisible();
    } finally {
      await first.close();
      await second.close();
    }
  });
});

test.describe('events', () => {
  test('a school schedules one and a member sees it on the calendar', async ({ page }) => {
    const { school, classId } = await schoolWithClass('D');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, school.email);
    await page.goto('/school/events');
    await expect(page.getByText('Nothing scheduled.')).toBeVisible();

    await page.getByLabel('Title').fill('Annual day');
    // A fixed future date: relative dates make a test that fails in a year.
    await page.getByLabel('When').fill('2030-12-05T10:00');
    await page.getByLabel('Details').fill('In the main hall, from 10am.');
    await page.getByRole('button', { name: 'Add event' }).click();

    await expect(page.getByText('Everyone at the school has been notified.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);

    await page.getByRole('link', { name: 'Events' }).click();
    await expect(page.getByRole('heading', { name: 'Annual day' })).toBeVisible();
    await expect(page.getByText('In the main hall, from 10am.')).toBeVisible();
    // Rendered as a date a parent reads, not an ISO string.
    await expect(page.getByText('Thursday 5 December')).toBeVisible();
  });

  test('a past event is hidden until asked for', async ({ page }) => {
    const { school, classId } = await schoolWithClass('E');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, school.email);
    await page.goto('/school/events');
    await page.getByLabel('Title').fill('Founders day');
    await page.getByLabel('When').fill('2020-03-01T09:00');
    await page.getByLabel('Details').fill('This already happened.');
    await page.getByRole('button', { name: 'Add event' }).click();
    await expect(page.getByText('Everyone at the school has been notified.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);

    await page.goto('/events');
    await expect(page.getByText('Nothing coming up.')).toBeVisible();

    await page.getByRole('link', { name: 'Including past' }).click();
    await expect(page.getByRole('heading', { name: 'Founders day' })).toBeVisible();
  });
});
