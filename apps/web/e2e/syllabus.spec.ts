/**
 * Syllabus coverage, driven by a browser (S2-10).
 *
 * The rule under test is the one a school actually cares about: a teacher records progress for
 * the subject they were allocated, everyone in the class can see how far it has got, and nobody
 * else can touch it.
 */
import { expect, test } from '@playwright/test';

import {
  createClass,
  createSchool,
  verifiedStudentIn,
  verifiedTeacherFor,
  type School,
} from './support/accounts';
import { signIn } from './support/auth';

async function schoolWithClass(section: string): Promise<{ school: School; classId: string }> {
  const school = await createSchool('syllabus');
  const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_10', section });
  return { school, classId: klass.id };
}

test.describe('syllabus coverage', () => {
  test('a teacher records progress and the class sees it', async ({ page }) => {
    const { school, classId } = await schoolWithClass('A');
    const { teacher } = await verifiedTeacherFor(school, classId, 'Mathematics');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, teacher.email);
    await page.goto(`/classes/${classId}/syllabus`);
    await expect(page.getByText('Nothing recorded yet.')).toBeVisible();

    await page.getByLabel('Topic').fill('Chapter 1: Integers');
    await page.getByLabel('Covered (%)').fill('40');
    await page.getByRole('button', { name: 'Record coverage' }).click();

    await expect(page.getByText('Coverage recorded.')).toBeVisible();
    await expect(page.getByText('Chapter 1: Integers')).toBeVisible();

    // The percentage is text as well as a bar, and the bar carries it in its accessible name.
    await expect(page.getByRole('progressbar', { name: /Chapter 1: Integers: 40%/ })).toBeVisible();

    // Now the student, who may look but not touch.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);

    await page.goto(`/classes/${classId}`);
    await page.getByRole('link', { name: 'Syllabus' }).click();

    await expect(page).toHaveURL(`/classes/${classId}/syllabus`);
    await expect(page.getByText('Chapter 1: Integers')).toBeVisible();
    await expect(page.getByText('40% covered overall')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record coverage' })).toBeHidden();
  });

  test('recording the same topic again updates it rather than adding a second', async ({
    page,
  }) => {
    const { school, classId } = await schoolWithClass('B');
    const { teacher } = await verifiedTeacherFor(school, classId, 'Science');

    await signIn(page, teacher.email);
    await page.goto(`/classes/${classId}/syllabus`);

    for (const percent of ['30', '80']) {
      await page.getByLabel('Topic').fill('Chapter 2: Cells');
      await page.getByLabel('Covered (%)').fill(percent);
      await page.getByRole('button', { name: 'Record coverage' }).click();

      // Waits on the figure itself: the success message from the first round is still on screen
      // when the second starts, so waiting on it would pass instantly and race the re-render.
      await expect(
        page.getByRole('progressbar', { name: new RegExp(`Chapter 2: Cells: ${percent}%`) }),
      ).toBeVisible();
    }

    await expect(page.getByText('Chapter 2: Cells')).toHaveCount(1);
  });

  test('a non-member cannot reach the page at all', async ({ page }) => {
    const { school, classId } = await schoolWithClass('C');
    const outsider = await createSchool('rival');

    // A rival school is the sharpest case: an authenticated account with no membership here.
    await signIn(page, outsider.email);
    await page.goto(`/classes/${classId}/syllabus`);

    await expect(page.getByText('404')).toBeVisible();
    expect(school.accountId).not.toBe(outsider.accountId);
  });
});
