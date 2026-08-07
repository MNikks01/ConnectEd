/**
 * Attendance in a browser — S8-5 (FR-ATT-001, 010, 030).
 *
 * The API suite proves the rules; this proves the two things it cannot. That the register a teacher
 * actually sees offers *Excused* for a pupil the school gave leave to — the rule is worthless if it
 * lives only in a response body nobody renders. And that a pupil's page contains their own days and
 * not the class's.
 */
import { expect, test } from '@playwright/test';

import {
  allocateClassTeacher,
  createClass,
  createSchool,
  verifiedStudentIn,
  verifiedTeacherFor,
  type School,
} from './support/accounts';
import { signIn } from './support/auth';

async function schoolWithClass(section: string): Promise<{ school: School; classId: string }> {
  const school = await createSchool('register');
  const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_7', section });
  return { school, classId: klass.id };
}

test.describe('attendance', () => {
  test('a teacher takes the register and the pupil sees only their own day', async ({ page }) => {
    const { school, classId } = await schoolWithClass('A');
    const { teacher } = await verifiedTeacherFor(school, classId, 'Mathematics');
    // A subject teacher is not a class teacher, and the API refuses them the register — so the
    // school allocates one first, which is what a school actually does (FR-INST-004).
    await allocateClassTeacher(school, classId, teacher);
    const present = await verifiedStudentIn(school, classId, 'present');
    const away = await verifiedStudentIn(school, classId, 'away');

    await signIn(page, teacher.email);
    await page.goto(`/classes/${classId}/register`);

    await expect(page.getByText('Nobody has taken this register yet.')).toBeVisible();

    // Radio groups are named for the pupil, so this is unambiguous about who is being marked.
    await page
      .getByRole('group', { name: away.fullName })
      .getByRole('radio', { name: 'Absent' })
      .check();
    await page.getByRole('button', { name: 'Take the register' }).click();

    await expect(page.getByText('This register has been taken.')).toBeVisible();

    // The absent pupil sees their own day and nothing about the other child.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, away.email);
    await page.goto(`/classes/${classId}/register`);

    await expect(page.getByText('Absent')).toBeVisible();
    expect(await page.content()).not.toContain(present.fullName);
  });
});
