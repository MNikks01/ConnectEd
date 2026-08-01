/**
 * The class feed and notifications, driven by a browser (S2-7, S2-8).
 *
 * This is the member half of the promise the portal tests cover from the school side: a verified
 * student finds their own class without being handed a link, sees what a teacher published, and
 * is told about it. The teacher→queue→student path crosses two accounts, the API, Redis, and the
 * worker, and nothing below the browser can assert the whole chain.
 */
import { expect, test } from '@playwright/test';

import {
  createClass,
  createIndividual,
  createSchool,
  verifiedStudentIn,
  verifiedTeacherFor,
  type School,
} from './support/accounts';
import { signIn } from './support/auth';
import { clickUntil } from './support/interactions';

async function schoolWithClass(section: string): Promise<{ school: School; classId: string }> {
  const school = await createSchool('feed');
  const klass = await createClass(school, {
    medium: 'ENGLISH',
    level: 'CLASS_7',
    section,
  });
  return { school, classId: klass.id };
}

test.describe('finding your class', () => {
  test('an unverified member is told why they see no classes', async ({ page }) => {
    const person = await createIndividual('unverified');
    await signIn(page, person.email);

    await expect(page.getByText('You are not a verified member of any class yet.')).toBeVisible();
  });

  test('a verified student reaches their class from home', async ({ page }) => {
    const { school, classId } = await schoolWithClass('A');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, student.email);

    await page.getByRole('link', { name: 'Class 7-A (English)' }).click();

    await expect(page).toHaveURL(`/classes/${classId}`);
    await expect(page.getByText('Nothing has been published to this class yet.')).toBeVisible();
  });

  test('a non-member cannot open the class by guessing its URL', async ({ page }) => {
    const { classId } = await schoolWithClass('B');
    const outsider = await createIndividual('nosy');

    await signIn(page, outsider.email);
    await page.goto(`/classes/${classId}`);

    // The API refuses, and the portal renders that as a 404 rather than a nicer message that
    // would confirm the class exists.
    await expect(page.getByText('404')).toBeVisible();
  });
});

test.describe('publishing and reading', () => {
  test('a teacher publishes and every reader sees it, with a notification', async ({ page }) => {
    const { school, classId } = await schoolWithClass('C');
    const { teacher } = await verifiedTeacherFor(school, classId, 'Mathematics');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, teacher.email);
    await page.goto(`/classes/${classId}`);

    await page.getByLabel('Type').selectOption('HOMEWORK');
    await page.getByLabel('Subject').selectOption({ label: 'Mathematics' });
    await page.getByLabel('Title').fill('Chapter 4 exercises');
    await page.getByLabel('Details').fill('Questions 1 to 10, in your notebook.');
    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText('Everyone in the class has been notified.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chapter 4 exercises' })).toBeVisible();

    // The author sees who has read it; nobody else does.
    await expect(page.getByText('Read by 0')).toBeVisible();

    // Now the student, in the same browser, as a different person.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);

    await page.goto(`/classes/${classId}`);
    await expect(page.getByText('Unread')).toBeVisible();
    await expect(page.getByText('Read by')).toBeHidden();

    await page.getByRole('link', { name: 'Chapter 4 exercises' }).click();
    await expect(page.getByText('Questions 1 to 10, in your notebook.')).toBeVisible();

    // Opening it is what marks it read — there is no button to press.
    await page.goto(`/classes/${classId}`);
    await expect(page.getByText('Unread')).toBeHidden();
  });

  test('a student cannot publish', async ({ page }) => {
    const { school, classId } = await schoolWithClass('D');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, student.email);
    await page.goto(`/classes/${classId}`);

    await expect(page.getByRole('button', { name: 'Publish' })).toBeHidden();
  });
});

test.describe('notifications', () => {
  test('published work reaches the student’s notification list', async ({ page }) => {
    const { school, classId } = await schoolWithClass('D');
    const { teacher } = await verifiedTeacherFor(school, classId, 'Science');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, teacher.email);
    await page.goto(`/classes/${classId}`);
    await page.getByLabel('Subject').selectOption({ label: 'Science' });
    await page.getByLabel('Title').fill('Photosynthesis notes');
    await page.getByLabel('Details').fill('Read pages 30 to 34.');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Everyone in the class has been notified.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);

    // Fan-out runs on the queue, so the notification arrives shortly after the write commits.
    await expect(async () => {
      await page.goto('/notifications');
      await expect(page.getByText('Photosynthesis notes')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    // Two, not one: approving this student's request notified them as well (FR-VER-005). The
    // count is in the link's accessible name, not only a coloured pill.
    await expect(page.getByRole('link', { name: 'Notifications, 2 unread' })).toBeVisible();
    await expect(page.getByText('Your school decided on your request to join.')).toBeVisible();

    await clickUntil(page.getByRole('button', { name: 'Mark all as read' }), async () => {
      await expect(page.getByText('Everything here has been read.')).toBeVisible({ timeout: 2000 });
    });
    await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();
  });

  test('the notification links to the item it announces', async ({ page }) => {
    const { school, classId } = await schoolWithClass('E');
    const { teacher } = await verifiedTeacherFor(school, classId, 'History');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, teacher.email);
    await page.goto(`/classes/${classId}`);
    await page.getByLabel('Subject').selectOption({ label: 'History' });
    await page.getByLabel('Title').fill('Mughal empire timeline');
    await page.getByLabel('Details').fill('Draw the timeline from 1526 to 1707.');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Everyone in the class has been notified.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);

    await expect(async () => {
      await page.goto('/notifications');
      await expect(page.getByRole('link', { name: /Mughal empire timeline/ })).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 15_000 });

    await page.getByRole('link', { name: /Mughal empire timeline/ }).click();
    await expect(page.getByText('Draw the timeline from 1526 to 1707.')).toBeVisible();
  });
});
