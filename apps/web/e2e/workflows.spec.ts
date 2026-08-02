/**
 * Leave and complaints, driven by a browser (S3-8, S3-9).
 *
 * The chain these tests walk is the one the sprint is about: a parent applies, the class teacher of
 * *that* class decides, and the parent sees the outcome. Nothing below the browser can assert that
 * the person who was allocated to the class is the one holding the buttons.
 */
import { expect, test } from '@playwright/test';

import {
  approveVerification,
  createClass,
  createIndividual,
  createSchool,
  createSubject,
  submitStudentVerification,
  submitTeacherVerification,
  verifiedTeacherFor,
  type Individual,
  type School,
} from './support/accounts';
import { signIn } from './support/auth';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4810/api/v1';

/** A parent with a verified child in a class — the applicant half of the chain. */
async function verifiedParentWithChild(
  school: School,
  classId: string,
): Promise<{ parent: Individual; childName: string }> {
  const parent = await createIndividual('parent');
  const childName = `Child ${Date.now()}`;

  const response = await fetch(`${API_URL}/verifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'mobile',
      Authorization: `Bearer ${parent.accessToken}`,
    },
    body: JSON.stringify({
      role: 'PARENT',
      schoolId: school.accountId,
      classId,
      childFullName: childName,
    }),
  });

  if (!response.ok) {
    throw new Error(`parent verification failed: ${response.status} ${await response.text()}`);
  }

  await approveVerification(school, ((await response.json()) as { id: string }).id);

  return { parent, childName };
}

/** Allocates a teacher as class teacher of the class, which is who decides student leave. */
async function allocateClassTeacher(
  school: School,
  classId: string,
  teacher: Individual,
): Promise<void> {
  const response = await fetch(`${API_URL}/classes/${classId}/class-teacher`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${school.accessToken}`,
    },
    body: JSON.stringify({ teacherAccountId: teacher.accountId }),
  });

  if (!response.ok) {
    throw new Error(`allocation failed: ${response.status} ${await response.text()}`);
  }
}

async function schoolWithClass(section: string): Promise<{ school: School; classId: string }> {
  const school = await createSchool('wf');
  const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_4', section });
  return { school, classId: klass.id };
}

test.describe('leave', () => {
  test('a parent applies, the class teacher decides, the parent sees the outcome', async ({
    page,
  }) => {
    const { school, classId } = await schoolWithClass('A');
    const { teacher } = await verifiedTeacherFor(school, classId, 'Mathematics');
    await allocateClassTeacher(school, classId, teacher);
    const { parent, childName } = await verifiedParentWithChild(school, classId);

    await signIn(page, parent.email);
    await page.goto('/leave');

    await page.getByLabel('Child').selectOption({ label: `${childName} — Class 4-A (English)` });
    await page.getByLabel('First day').fill('2026-09-14');
    await page.getByLabel('Last day').fill('2026-09-16');
    await page.getByLabel('Reason').fill('A family wedding out of town.');
    await page.getByRole('button', { name: 'Apply for leave' }).click();

    await expect(page.getByText('Sent to the class teacher.')).toBeVisible();
    await expect(page.getByText('Waiting')).toBeVisible();

    // The class teacher, in the same browser.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, teacher.email);

    await page.goto('/leave/approvals');
    await expect(page.getByText(childName)).toBeVisible();
    await expect(page.getByText('A family wedding out of town.')).toBeVisible();

    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByText('No leave waiting for this class.')).toBeVisible();

    // Back to the parent, who now sees the decision.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, parent.email);
    await page.goto('/leave');

    await expect(page.getByText('accepted')).toBeVisible();
  });

  test('a teacher with no class-teacher allocation is offered nothing to decide', async ({
    page,
  }) => {
    const { school, classId } = await schoolWithClass('B');
    const { teacher } = await verifiedTeacherFor(school, classId, 'Science');

    await signIn(page, teacher.email);
    await page.goto('/leave/approvals');

    await expect(page.getByText('You are not a class teacher or a principal')).toBeVisible();
  });

  test('rejecting asks for confirmation first', async ({ page }) => {
    const { school, classId } = await schoolWithClass('C');
    const { teacher } = await verifiedTeacherFor(school, classId, 'History');
    await allocateClassTeacher(school, classId, teacher);
    const { parent } = await verifiedParentWithChild(school, classId);

    await signIn(page, parent.email);
    await page.goto('/leave');
    await page.getByLabel('First day').fill('2026-09-14');
    await page.getByLabel('Last day').fill('2026-09-14');
    await page.getByLabel('Reason').fill('A day out.');
    await page.getByRole('button', { name: 'Apply for leave' }).click();
    await expect(page.getByText('Sent to the class teacher.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, teacher.email);
    await page.goto('/leave/approvals');

    await page.getByRole('button', { name: 'Reject' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('cannot be reopened');

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    // Cancelling leaves it exactly where it was.
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
  });

  test('a student is told leave is not theirs to apply for', async ({ page }) => {
    const { school, classId } = await schoolWithClass('D');
    const student = await createIndividual('leavestudent');
    const request = await submitStudentVerification(student, school.accountId, classId);
    await approveVerification(school, request.id);

    await signIn(page, student.email);
    await page.goto('/leave');

    await expect(page.getByText('Neither applies to you yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply for leave' })).toBeHidden();
  });
});

test.describe('complaints', () => {
  test('a parent raises one and the school resolves it', async ({ page }) => {
    const { school, classId } = await schoolWithClass('E');
    const { parent } = await verifiedParentWithChild(school, classId);

    await signIn(page, parent.email);
    await page.goto('/complaints');

    await page.getByLabel('Type').selectOption('COMPLAINT');
    await page.getByLabel('Details').fill('The bus has been late every day this week.');
    await page.getByRole('button', { name: 'Send to the school' }).click();

    await expect(page.getByText('The school can see who raised it.')).toBeVisible();
    await expect(page.getByText('Not yet read')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, school.email);
    await page.goto('/school/complaints');

    await expect(page.getByText('The bus has been late every day this week.')).toBeVisible();
    // Named, not anonymous.
    await expect(page.getByText('E2E parent')).toBeVisible();

    await page.getByRole('button', { name: 'Mark resolved' }).click();
    // Scoped to the list: "Resolved" is also one of the status filters in the nav above it.
    await expect(
      page.getByRole('list', { name: 'Complaints and suggestions' }).getByText('Resolved'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, parent.email);
    await page.goto('/complaints');

    await expect(
      page.getByRole('list', { name: 'What you have raised' }).getByText('Resolved'),
    ).toBeVisible();
  });

  test('a teacher can raise one but not resolve it', async ({ page }) => {
    const school = await createSchool('wf-teacher');
    const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_4', section: 'A' });
    const subject = await createSubject(school, klass.id, 'Mathematics');
    const teacher = await createIndividual('complainer');
    const request = await submitTeacherVerification(teacher, school.accountId, [subject.id]);
    await approveVerification(school, request.id);

    await signIn(page, teacher.email);
    await page.goto('/complaints');

    await page.getByLabel('Details').fill('The staff room printer has been broken for a month.');
    await page.getByRole('button', { name: 'Send to the school' }).click();
    await expect(page.getByText('The school can see who raised it.')).toBeVisible();

    // The portal that reviews complaints is closed to an individual entirely.
    await page.goto('/school/complaints');
    await expect(page).toHaveURL('/home');
  });

  test('a student is not offered the form', async ({ page }) => {
    const { school, classId } = await schoolWithClass('B');
    const student = await createIndividual('quietstudent');
    const request = await submitStudentVerification(student, school.accountId, classId);
    await approveVerification(school, request.id);

    await signIn(page, student.email);
    await page.goto('/complaints');

    await expect(page.getByRole('button', { name: 'Send to the school' })).toBeHidden();
    await expect(page.getByText('Complaints are raised by parents and staff.')).toBeVisible();
  });
});
