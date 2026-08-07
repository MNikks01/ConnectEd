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
    const { teacher } = await verifiedTeacherFor(school, classId, 'Mathematics');
    const alice = await verifiedStudentIn(school, classId, 'alice');
    const bob = await verifiedStudentIn(school, classId, 'bob');

    await signIn(page, teacher.email);

    // **Created through the form, deliberately.** The first version of this spec set the
    // assessment up through the API, and the product shipped with no way for a teacher to create
    // one at all — every check passed because the test used the back door. A fixture shortcut is a
    // claim that the front door works, not a test of it (S8-1).
    await page.goto(`/classes/${classId}/marks`);
    await page.getByLabel('Subject').selectOption({ label: 'Mathematics' });
    await page.getByLabel('Kind').selectOption('TEST');
    await page.getByLabel('Assessment name').fill('Fractions test');
    await page.getByLabel('Out of').fill('20');
    await page.getByLabel('Date sat').fill('2026-08-01');
    await page.getByRole('button', { name: 'Create assessment' }).click();

    await expect(page.getByRole('link', { name: 'Fractions test' })).toBeVisible();
    await page.getByRole('link', { name: 'Fractions test' }).click();

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
    await page.goto(`/classes/${classId}/marks`);
    await page.getByRole('link', { name: 'Fractions test' }).click();
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

  test('a published mark can be corrected, and the pupil sees the new one', async ({ page }) => {
    const { school, classId } = await schoolWithClass('D');
    const { teacher } = await verifiedTeacherFor(school, classId, 'Mathematics');
    // Two pupils, because with one the test cannot tell "corrected the right pupil" from
    // "corrected the first pupil" — and a component that always corrected `marks[0]` passed the
    // single-pupil version of this test.
    const first = await verifiedStudentIn(school, classId, 'first');
    const second = await verifiedStudentIn(school, classId, 'second');

    await signIn(page, teacher.email);
    await page.goto(`/classes/${classId}/marks`);
    await page.getByLabel('Subject').selectOption({ label: 'Mathematics' });
    await page.getByLabel('Kind').selectOption('TEST');
    await page.getByLabel('Assessment name').fill('Long division');
    await page.getByLabel('Out of').fill('10');
    await page.getByLabel('Date sat').fill('2026-08-02');
    await page.getByRole('button', { name: 'Create assessment' }).click();

    await page.getByRole('link', { name: 'Long division' }).click();
    await page.getByLabel(`Score for ${first.fullName}`).fill('3');
    await page.getByLabel(`Score for ${second.fullName}`).fill('6');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.getByRole('button', { name: 'Publish marks' }).click();
    await page.getByRole('button', { name: 'Yes, publish these marks' }).click();
    await expect(
      page.getByText('These marks are published and the class can see them.'),
    ).toBeVisible();

    // The correction: a transcription error, found after publishing. This is the path that existed
    // only on the server until S8-2 — audited since the day it shipped, and unreachable.
    await page.getByLabel(`New score for ${second.fullName}`).fill('8');
    await page.getByRole('button', { name: `Correct ${second.fullName}’s mark` }).click();
    await expect(page.getByText('Corrected. The change has been recorded.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, second.email);
    await page.goto(`/classes/${classId}/marks`);

    // The corrected pupil sees the new mark, and no trace of the audit: that row is for the
    // school, not for the child. Asserted on the rendered score element rather than page HTML —
    // a bare "8" also appears in chunk filenames, which is how the first version of this passed
    // for the wrong reason.
    await expect(page.getByText('out of 10')).toBeVisible();
    await expect(page.locator('main strong').first()).toHaveText('8');
    await expect(page.getByText('Corrected')).toHaveCount(0);

    // And the pupil who was *not* corrected still has their own mark. This is the assertion that
    // fails when the form corrects `marks[0]` regardless of whose button was pressed.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, first.email);
    await page.goto(`/classes/${classId}/marks`);

    await expect(page.locator('main strong').first()).toHaveText('3');
  });
});
