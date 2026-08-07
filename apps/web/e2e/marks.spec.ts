/**
 * Marks, driven by a browser — S7-7 (FR-GRADE-010, 011, 020).
 *
 * The API suite already proves the rules. What a browser adds is the thing that suite cannot: that
 * the *page* a pupil actually loads contains their mark and not their classmate's. Every previous
 * academic screen could be checked by asking "does the class see it"; this one has to be checked by
 * asking "does exactly one child see it", and the answer lives in rendered HTML.
 */
import { expect, test } from '@playwright/test';

import {
  createAssessment,
  createClass,
  createSchool,
  verifiedStudentIn,
  verifiedTeacherFor,
  type School,
} from './support/accounts';
import { signIn } from './support/auth';

async function schoolWithClass(section: string): Promise<{ school: School; classId: string }> {
  const school = await createSchool('marks');
  const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_7', section });
  return { school, classId: klass.id };
}

test.describe('marks', () => {
  test('a pupil sees their own mark and not a classmate’s', async ({ page }) => {
    const { school, classId } = await schoolWithClass('E');
    const { teacher, subjectId } = await verifiedTeacherFor(school, classId, 'Mathematics');
    const alice = await verifiedStudentIn(school, classId, 'alice');
    const bob = await verifiedStudentIn(school, classId, 'bob');

    // Set the assessment up through the API as the teacher, then read it as each pupil in a
    // browser — which is the only place the "one child, not the class" promise is visible.
    await signIn(page, teacher.email);

    const assessment = await createAssessment(teacher, classId, subjectId);

    await page.goto(`/classes/${classId}/marks/${assessment.id}`);

    // The grid carries every pupil, marked or not.
    await expect(page.getByLabel(`Score for ${alice.fullName}`)).toBeVisible();
    await expect(page.getByLabel(`Score for ${bob.fullName}`)).toBeVisible();

    await page.getByLabel(`Score for ${alice.fullName}`).fill('17.5');
    await page.getByLabel(`Score for ${bob.fullName}`).fill('4');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Saved. Nobody can see these yet.')).toBeVisible();

    // A draft is not a result: the pupil sees nothing yet.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, alice.email);
    await page.goto(`/classes/${classId}/marks`);
    await expect(page.getByText('No marks have been published yet.')).toBeVisible();

    // Publish.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, teacher.email);
    await page.goto(`/classes/${classId}/marks/${assessment.id}`);
    await page.getByRole('button', { name: 'Publish marks' }).click();
    await page.getByRole('button', { name: 'Yes, publish these marks' }).click();

    // Assert on the *state*, not the success message. Publishing revalidates the page, and the
    // re-render replaces the whole form — success message included — with the published card. On a
    // fast machine the message paints first and the assertion passes; in CI the revalidation wins
    // and it never exists. This is the S6-13 lesson again: a test that reads something transient
    // passes for a reason unrelated to the thing it is checking.
    await expect(
      page.getByText('These marks are published and the class can see them.'),
    ).toBeVisible();

    // Alice sees 17.5 and nothing of Bob's 4.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, alice.email);
    await page.goto(`/classes/${classId}/marks`);

    await expect(page.getByText('17.5')).toBeVisible();
    const alicePage = (await page.content()).replace(/17\.5/g, '');
    expect(alicePage).not.toContain(bob.fullName);

    // And Bob sees 4, not 17.5. The same page, a different child, a different truth.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, bob.email);
    await page.goto(`/classes/${classId}/marks`);

    await expect(page.getByText('out of 20')).toBeVisible();
    expect(await page.content()).not.toContain('17.5');
  });
});
