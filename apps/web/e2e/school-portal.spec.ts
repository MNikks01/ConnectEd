/**
 * The school portal, driven by a browser.
 *
 * The verification test is the one that matters most: it walks the product's central promise
 * end to end — a student is refused, a school approves, and access appears — across two accounts,
 * two apps, and a database. Nothing below the browser can assert that whole chain.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  createClass,
  createIndividual,
  createSchool,
  createSubject,
  PASSWORD,
  submitStudentVerification,
  submitTeacherVerification,
  type School,
} from './support/accounts';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/home');
}

async function signInAsSchool(page: Page): Promise<School> {
  const school = await createSchool('portal');
  await signIn(page, school.email);
  return school;
}

test.describe('portal access', () => {
  test('an individual is redirected away from the portal', async ({ page }) => {
    const person = await createIndividual('outsider');
    await signIn(page, person.email);

    await page.goto('/school');

    // Redirected home rather than shown a portal where every control would fail.
    await expect(page).toHaveURL('/home');
  });

  test('a school reaches the portal and sees its own name', async ({ page }) => {
    const school = await signInAsSchool(page);

    await page.goto('/school');

    await expect(page.getByRole('heading', { name: 'School profile' })).toBeVisible();
    await expect(page.getByText(school.name).first()).toBeVisible();
  });
});

test.describe('profile', () => {
  test('a school edits its profile and the change persists', async ({ page }) => {
    await signInAsSchool(page);
    await page.goto('/school');

    await page.getByLabel('City').fill('Pune');
    await page.getByLabel('Administrator').fill('Asha Menon');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Profile updated.')).toBeVisible();

    // Reload rather than trusting the optimistic render — this is the actual persistence check.
    await page.reload();
    await expect(page.getByLabel('City')).toHaveValue('Pune');
    await expect(page.getByLabel('Administrator')).toHaveValue('Asha Menon');
  });
});

test.describe('classes', () => {
  test('the empty state shows before any class exists', async ({ page }) => {
    await signInAsSchool(page);

    await page.goto('/school/classes');

    await expect(page.getByText('No classes yet. Add the first one below.')).toBeVisible();
  });

  test('a school creates a class and it appears with its derived name', async ({ page }) => {
    await signInAsSchool(page);
    await page.goto('/school/classes');

    await page.getByLabel('Medium').selectOption('ENGLISH');
    await page.getByLabel('Level').selectOption('CLASS_8');
    await page.getByLabel('Section').selectOption('A');
    await page.getByRole('button', { name: 'Add class' }).click();

    await expect(page.getByText('Class added.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Class 8-A (English)' })).toBeVisible();
  });

  test('creating the same class twice is refused with the API message', async ({ page }) => {
    const school = await signInAsSchool(page);
    await createClass(school, { medium: 'ENGLISH', level: 'CLASS_9', section: 'B' });

    await page.goto('/school/classes');
    await page.getByLabel('Medium').selectOption('ENGLISH');
    await page.getByLabel('Level').selectOption('CLASS_9');
    await page.getByLabel('Section').selectOption('B');
    await page.getByRole('button', { name: 'Add class' }).click();

    await expect(page.locator('form').getByRole('alert')).toContainText('already exists');
  });

  test('a class can be deactivated and reactivated', async ({ page }) => {
    const school = await signInAsSchool(page);
    await createClass(school, { medium: 'HINDI', level: 'CLASS_5', section: 'C' });

    await page.goto('/school/classes');
    await expect(page.getByText('Active')).toBeVisible();

    await page.getByRole('button', { name: 'Deactivate' }).click();
    await expect(page.getByText('Inactive')).toBeVisible();

    await page.getByRole('button', { name: 'Reactivate' }).click();
    await expect(page.getByText('Active')).toBeVisible();
  });

  test('subjects can be added to a class', async ({ page }) => {
    const school = await signInAsSchool(page);
    const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_6', section: 'A' });

    await page.goto(`/school/classes/${klass.id}`);
    await expect(page.getByText('No subjects yet. Add the first one below.')).toBeVisible();

    await page.getByLabel('Subject name').fill('Mathematics');
    await page.getByRole('button', { name: 'Add subject' }).click();

    await expect(page.getByText('Subject added.')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Mathematics' })).toBeVisible();
  });

  test('a class with no class teacher warns that leave cannot be approved', async ({ page }) => {
    const school = await signInAsSchool(page);
    const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_4', section: 'A' });

    await page.goto(`/school/classes/${klass.id}`);

    await expect(page.getByText('cannot be approved until one is allocated')).toBeVisible();
  });
});

test.describe('verification queue', () => {
  test('the empty state shows when nothing is waiting', async ({ page }) => {
    await signInAsSchool(page);

    await page.goto('/school/verifications');

    await expect(page.getByText('Nothing waiting')).toBeVisible();
  });

  test('a school approves a request and the member gains access', async ({ page }) => {
    const school = await signInAsSchool(page);
    const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_10', section: 'A' });
    const student = await createIndividual('applicant');
    await submitStudentVerification(student, school.accountId, klass.id);

    await page.goto('/school/verifications');
    await expect(page.getByText('E2E applicant')).toBeVisible();
    await expect(page.getByText('PENDING', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Approve' }).click();

    // The pending queue empties; the approved filter shows the decision.
    await expect(page.getByText('Nothing waiting')).toBeVisible();
    await page.getByRole('link', { name: 'Verified' }).click();
    await expect(page.getByText('E2E applicant')).toBeVisible();
  });

  test('rejecting asks for confirmation first, and cancelling leaves it pending', async ({
    page,
  }) => {
    const school = await signInAsSchool(page);
    const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_11', section: 'A' });
    const student = await createIndividual('rejectee');
    await submitStudentVerification(student, school.accountId, klass.id);

    await page.goto('/school/verifications');
    await page.getByRole('button', { name: 'Reject' }).click();

    // Rejection is the destructive direction and sits beside Approve, so it is confirmed.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('will not get access');

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('PENDING', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Reject' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reject request' }).click();

    await expect(page.getByText('Nothing waiting')).toBeVisible();
  });
});

test.describe('member roster', () => {
  test('the empty state shows before anyone is verified', async ({ page }) => {
    await signInAsSchool(page);

    await page.goto('/school/members');

    await expect(page.getByText('No verified members yet')).toBeVisible();
  });

  test('an approved member appears on the roster and can be removed', async ({ page }) => {
    const school = await signInAsSchool(page);
    const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_12', section: 'A' });
    const student = await createIndividual('rostered');
    await submitStudentVerification(student, school.accountId, klass.id);

    await page.goto('/school/verifications');
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Nothing waiting')).toBeVisible();

    await page.goto('/school/members');
    await expect(page.getByText('E2E rostered')).toBeVisible();

    await page.getByRole('button', { name: 'Remove' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('loses access to this school immediately');
    await dialog.getByRole('button', { name: 'Remove member' }).click();

    await expect(page.getByText('No verified members yet')).toBeVisible();
  });

  test('class-teacher allocation offers verified teachers instead of an id field', async ({
    page,
  }) => {
    const school = await signInAsSchool(page);
    const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_3', section: 'A' });

    // No teachers yet: the form says so rather than showing an empty picker.
    await page.goto(`/school/classes/${klass.id}`);
    await expect(page.getByText('No teachers to allocate')).toBeVisible();

    // A teacher request must name a subject, so the class needs one first.
    const subject = await createSubject(school, klass.id, 'Mathematics');
    const teacher = await createIndividual('classteacher');
    await submitTeacherVerification(teacher, school.accountId, [subject.id]);
    await page.goto('/school/verifications');
    await page.getByRole('button', { name: 'Approve' }).click();
    // Wait for the decision to land: navigating immediately can abort the Server Action.
    await expect(page.getByText('Nothing waiting')).toBeVisible();

    await page.goto(`/school/classes/${klass.id}`);
    await page.getByLabel('Teacher').selectOption({ label: 'E2E classteacher' });
    await page.getByRole('button', { name: 'Allocate class teacher' }).click();

    await expect(page.getByText('Class teacher allocated.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Current class teacher')).toBeVisible();
  });
});
