/**
 * Role dashboards (S2-11).
 *
 * The dashboard is the one view that crosses the API's per-class scopes, so these tests are about
 * composition: a student sees work that is due, a teacher sees what they are allocated to teach,
 * and neither sees the other's section.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  createClass,
  createSchool,
  PASSWORD,
  verifiedStudentIn,
  verifiedTeacherFor,
  type School,
} from './support/accounts';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/home');
}

async function schoolWithClass(section: string): Promise<{ school: School; classId: string }> {
  const school = await createSchool('dash');
  const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_5', section });
  return { school, classId: klass.id };
}

/** Two days out, so it lands inside the "due soon" window whenever the suite runs. */
function inTwoDays(): string {
  return new Date(Date.now() + 2 * 24 * 3600_000).toISOString().slice(0, 16);
}

test.describe('the student and parent dashboard', () => {
  test('shows work that is due, and where it came from', async ({ page }) => {
    const { school, classId } = await schoolWithClass('A');
    const { teacher } = await verifiedTeacherFor(school, classId, 'Mathematics');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, teacher.email);
    await page.goto(`/classes/${classId}`);
    await page.getByLabel('Subject').selectOption({ label: 'Mathematics' });
    await page.getByLabel('Title').fill('Chapter 5 exercises');
    await page.getByLabel('Details').fill('Questions 1 to 10.');
    await page.getByLabel('Due').fill(inTwoDays());
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Everyone in the class has been notified.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);

    // The deadline is stated in days, not only as a date.
    await expect(page.getByText('due in 2 days')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chapter 5 exercises' }).first()).toBeVisible();
    await expect(page.getByText('Class 5-A (English)').first()).toBeVisible();

    // A student is not a teacher, so the teaching section is absent entirely.
    await expect(page.getByRole('heading', { name: 'What you teach' })).toBeHidden();
  });

  test('says so plainly when there is nothing due', async ({ page }) => {
    const { school, classId } = await schoolWithClass('B');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, student.email);

    await expect(page.getByText('Nothing with a deadline in the next week.')).toBeVisible();
  });

  test('surfaces a school notice', async ({ page }) => {
    const { school, classId } = await schoolWithClass('C');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, school.email);
    await page.goto('/school/notices');
    await page.getByLabel('Title').fill('Term ends on the 20th');
    await page.getByRole('textbox', { name: 'Notice' }).fill('Reports go home that day.');
    await page.getByRole('button', { name: 'Publish notice' }).click();
    await expect(page.getByRole('heading', { name: 'Term ends on the 20th' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);

    await expect(page.getByRole('heading', { name: 'From your school' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Term ends on the 20th' })).toBeVisible();
  });
});

test.describe('the teacher dashboard', () => {
  test('lists what the teacher is allocated to teach', async ({ page }) => {
    const { school, classId } = await schoolWithClass('D');
    const { teacher } = await verifiedTeacherFor(school, classId, 'Mathematics');

    await signIn(page, teacher.email);

    await expect(page.getByRole('heading', { name: 'What you teach' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Mathematics · Class 5-D (English)' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Syllabus coverage' })).toBeVisible();
  });
});
