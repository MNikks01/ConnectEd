/**
 * Report cards, driven by a browser — S8-7 (FR-GRADE-030 … 043).
 *
 * The API suite proves the rules. What only a browser can prove is that **the claim survives the
 * round trip**: a card is a document, so the number a family reads on a page they open tomorrow has
 * to be the number that was true when it was issued, not the number that is true when they look.
 * That is one assertion — correct a mark, reload, expect the old figure — and it is the reason the
 * whole feature was built the way it was.
 *
 * Everything here goes through the front door, including the term. The term form is new server
 * surface with a new screen, and a spec that created a term through the API would be repeating
 * S7-7's mistake: every check green while the product has no way in.
 */
import { expect, test } from '@playwright/test';

import {
  allocateClassTeacher,
  createClass,
  createSchool,
  verifiedStudentIn,
  verifiedTeacherFor,
} from './support/accounts';
import { signIn } from './support/auth';

test.describe('report cards', () => {
  test('a card keeps the numbers it was issued with', async ({ page }) => {
    const school = await createSchool('cards');
    const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_9', section: 'A' });
    const { teacher } = await verifiedTeacherFor(school, klass.id, 'Mathematics');
    await allocateClassTeacher(school, klass.id, teacher);

    // Two pupils, because a class of one cannot tell "issued for the right child" from "issued for
    // the first child" — the lesson S8-2 paid for.
    const alice = await verifiedStudentIn(school, klass.id, 'alice');
    const bob = await verifiedStudentIn(school, klass.id, 'bob');

    // The school defines the term. Nobody can issue anything until it does.
    await signIn(page, school.email);
    await page.goto('/school/terms');
    await expect(page.getByText('You have not set up any terms yet')).toBeVisible();

    await page.getByLabel('Name').fill('Term 1');
    await page.getByLabel('First day').fill('2026-07-01');
    await page.getByLabel('Last day').fill('2026-09-30');
    await page.getByRole('button', { name: 'Add the term' }).click();

    await expect(page.getByRole('cell', { name: 'Term 1' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'No cards issued yet' })).toBeVisible();

    // Overlap is refused, and the refusal names the term it clashes with — the message a registrar
    // can act on, rather than "conflict".
    await page.getByLabel('Name').fill('Term 2');
    await page.getByLabel('First day').fill('2026-09-01');
    await page.getByLabel('Last day').fill('2026-12-20');
    await page.getByRole('button', { name: 'Add the term' }).click();
    // The whole message, not the word "overlap" — which also appears in the page's own
    // description and in the field hint, so a looser match would pass without the server having
    // refused anything.
    await expect(page.getByText('Those dates overlap “Term 1”.')).toBeVisible();

    // The teacher sets and publishes a piece of work inside the term.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, teacher.email);
    await page.goto(`/classes/${klass.id}/marks`);
    await page.getByLabel('Subject').selectOption({ label: 'Mathematics' });
    await page.getByLabel('Kind').selectOption('TEST');
    await page.getByLabel('Assessment name').fill('Fractions test');
    await page.getByLabel('Out of').fill('20');
    await page.getByLabel('Date sat').fill('2026-08-01');
    await page.getByRole('button', { name: 'Create assessment' }).click();

    await page.getByRole('link', { name: 'Fractions test' }).click();
    await page.getByLabel(`Score for ${alice.fullName}`).fill('17.5');
    await page.getByLabel(`Score for ${bob.fullName}`).fill('4');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.getByRole('button', { name: 'Publish marks' }).click();
    await page.getByRole('button', { name: 'Yes, publish these marks' }).click();
    await expect(
      page.getByText('These marks are published and the class can see them.'),
    ).toBeVisible();

    // Issuing: one action, the whole class.
    await page.goto(`/classes/${klass.id}/report-cards`);
    await expect(page.getByText('No cards have been issued for this term yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Issue the class' }).click();

    // Asserted on the cards themselves rather than the success message: issuing revalidates the
    // page, and the re-render replaces the form the message lives in (the S6-13 lesson).
    await expect(page.getByRole('heading', { name: `${alice.fullName} — Term 1` })).toBeVisible();
    await expect(page.getByRole('heading', { name: `${bob.fullName} — Term 1` })).toBeVisible();
    await expect(page.getByText('17.50 / 20.00')).toBeVisible();
    await expect(page.getByText('4.00 / 20.00')).toBeVisible();

    // **The claim.** A correction after issue changes the mark and leaves the card alone.
    await page.goto(`/classes/${klass.id}/marks`);
    await page.getByRole('link', { name: 'Fractions test' }).click();
    await page.getByLabel(`New score for ${alice.fullName}`).fill('9');
    await page.getByRole('button', { name: `Correct ${alice.fullName}’s mark` }).click();
    await expect(page.getByText('Corrected. The change has been recorded.')).toBeVisible();

    await page.goto(`/classes/${klass.id}/report-cards`);
    await expect(page.getByText('17.50 / 20.00')).toBeVisible();
    // Not merely "the old number is present" — the new one must be absent, or a card that showed
    // both would pass the line above while being exactly the document nobody can explain.
    await expect(page.getByText('9.00 / 20.00')).toHaveCount(0);
  });

  test('a reissued card says what it replaced, and a pupil sees only their own', async ({
    page,
  }) => {
    const school = await createSchool('reissue');
    const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_9', section: 'B' });
    const { teacher } = await verifiedTeacherFor(school, klass.id, 'Science');
    await allocateClassTeacher(school, klass.id, teacher);
    const alice = await verifiedStudentIn(school, klass.id, 'alice');
    const bob = await verifiedStudentIn(school, klass.id, 'bob');

    await signIn(page, school.email);
    await page.goto('/school/terms');
    await page.getByLabel('Name').fill('Michaelmas');
    await page.getByLabel('First day').fill('2026-07-01');
    await page.getByLabel('Last day').fill('2026-09-30');
    await page.getByRole('button', { name: 'Add the term' }).click();
    await expect(page.getByRole('cell', { name: 'Michaelmas' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, teacher.email);
    await page.goto(`/classes/${klass.id}/marks`);
    await page.getByLabel('Subject').selectOption({ label: 'Science' });
    await page.getByLabel('Kind').selectOption('EXAM');
    await page.getByLabel('Assessment name').fill('Photosynthesis');
    await page.getByLabel('Out of').fill('50');
    await page.getByLabel('Date sat').fill('2026-08-05');
    await page.getByRole('button', { name: 'Create assessment' }).click();
    await page.getByRole('link', { name: 'Photosynthesis' }).click();
    await page.getByLabel(`Score for ${alice.fullName}`).fill('45');
    // Bob is left unmarked on purpose: the card must show him without a score and give him no
    // percentage, rather than scoring him zero for work he did not sit.
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.getByRole('button', { name: 'Publish marks' }).click();
    await page.getByRole('button', { name: 'Yes, publish these marks' }).click();
    await expect(
      page.getByText('These marks are published and the class can see them.'),
    ).toBeVisible();

    await page.goto(`/classes/${klass.id}/report-cards`);
    await page.getByRole('button', { name: 'Issue the class' }).click();
    await expect(
      page.getByRole('heading', { name: `${alice.fullName} — Michaelmas` }),
    ).toBeVisible();

    // Bob sat nothing that counted: "Not graded", not 0%.
    await expect(page.getByText('Not marked')).toBeVisible();
    await expect(page.getByText('Not graded').first()).toBeVisible();

    // The comments only appear once there are cards to write them against, so this is the second
    // pass — and the second pass is a reissue.
    await page.getByLabel(alice.fullName, { exact: true }).fill('A strong term.');
    await page.getByRole('button', { name: 'Reissue the class' }).click();

    // On the card, not in the box it was typed into: the textarea keeps its value either way, so
    // matching text alone would pass even if the comment never reached a document.
    await expect(page.getByRole('paragraph').filter({ hasText: 'A strong term.' })).toBeVisible();
    await expect(page.getByText('replaces the card issued').first()).toBeVisible();

    // A pupil sees their own card and nothing of their classmate's.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, alice.email);
    await page.goto(`/classes/${klass.id}/report-cards`);

    await expect(page.getByText('45.00 / 50.00')).toBeVisible();
    await expect(page.getByText('A strong term.')).toBeVisible();
    expect(await page.content()).not.toContain(bob.fullName);

    // And Bob's own card is his: issued, honest, and with no invented number on it.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, bob.email);
    await page.goto(`/classes/${klass.id}/report-cards`);

    await expect(page.getByRole('heading', { name: `${bob.fullName} — Michaelmas` })).toBeVisible();
    await expect(page.getByText('Not marked')).toBeVisible();
    const bobPage = await page.content();
    expect(bobPage).not.toContain(alice.fullName);
    expect(bobPage).not.toContain('A strong term.');
  });
});
