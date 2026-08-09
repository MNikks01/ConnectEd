/**
 * Accessibility, measured (S9-11, NFR-012).
 *
 * Every sprint's Definition of Done has said "UI ships Loading/Error/Empty/Success/Responsive/
 * **Accessible**" for nine sprints, and nothing has ever checked the last one. WCAG 2.1 AA is in
 * `TRD/00-technical-requirements.md` as NFR-012. This is the first thing that tests it.
 *
 * **An automated pass is not an accessibility audit.** axe finds roughly a third of WCAG issues —
 * the mechanical third: contrast, names, roles, labels, landmark structure. It cannot tell you
 * whether a heading describes its section, whether an error message says what to do, or whether the
 * marking grid can be operated by somebody who cannot see it. Those need a person. What this does
 * is stop the mechanical third from accumulating, which is the part that gets worse silently.
 *
 * Screens are visited **as the role that uses them**, with real data, because an empty page passes
 * everything: a table with no rows has no header problems and a form with no errors has no
 * `aria-describedby` to get wrong.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  allocateClassTeacher,
  createClass,
  createSchool,
  verifiedStudentIn,
  verifiedTeacherFor,
  type Individual,
  type School,
} from './support/accounts';
import { signIn } from './support/auth';

/** The rule sets NFR-012 names, and nothing wider — a failing "best practice" is not a breach. */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();

  // Reported as a readable list rather than a JSON dump: the failure message is the whole value of
  // this test, and "3 violations" sends somebody to a trace viewer for information the run already
  // had.
  const summary = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes.map((node) => `      ${node.target.join(' ')}`).join('\n'),
  );

  expect(summary, `${where} has WCAG 2.1 AA violations`).toEqual([]);
}

let school: School;
let classId: string;
let teacher: Individual;
let student: Individual;

/**
 * Everything is filled in before anything is scanned, and that is the difference between this and
 * a green tick. **An empty page passes every rule there is**: a table with no rows has no header
 * association to get wrong, a card list with no cards has no headings out of order, and a form
 * nobody has submitted has no error to leave unannounced. Each screen below is visited with the
 * thing on it that a real one would have.
 */
test.beforeAll(async ({ browser }) => {
  school = await createSchool('a11y');
  const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_6', section: 'A' });
  classId = klass.id;
  ({ teacher } = await verifiedTeacherFor(school, classId, 'Mathematics'));
  await allocateClassTeacher(school, classId, teacher);
  student = await verifiedStudentIn(school, classId, 'pupil');

  const context = await browser.newContext();
  const page = await context.newPage();

  // A term, so report cards have something to be issued against.
  await signIn(page, school.email);
  await page.goto('/school/terms');
  await page.getByLabel('Name').fill('Term 1');
  await page.getByLabel('First day').fill('2026-07-01');
  await page.getByLabel('Last day').fill('2026-09-30');
  await page.getByRole('button', { name: 'Add the term' }).click();
  await expect(page.getByRole('cell', { name: 'Term 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();

  // A published assessment, a register, and an issued card — the three screens most worth
  // scanning, and the three that are blank until somebody does this.
  await signIn(page, teacher.email);

  await page.goto(`/classes/${classId}/marks`);
  await page.getByLabel('Subject').selectOption({ label: 'Mathematics' });
  await page.getByLabel('Kind').selectOption('TEST');
  await page.getByLabel('Assessment name').fill('Fractions test');
  await page.getByLabel('Out of').fill('20');
  await page.getByLabel('Date sat').fill('2026-08-01');
  await page.getByRole('button', { name: 'Create assessment' }).click();
  await page.getByRole('link', { name: 'Fractions test' }).click();
  await page.getByLabel(`Score for ${student.fullName}`).fill('17.5');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByRole('button', { name: 'Publish marks' }).click();
  await page.getByRole('button', { name: 'Yes, publish these marks' }).click();
  await expect(
    page.getByText('These marks are published and the class can see them.'),
  ).toBeVisible();

  await page.goto(`/classes/${classId}/register`);
  await page.getByRole('button', { name: 'Take the register' }).click();

  await page.goto(`/classes/${classId}/report-cards`);
  await page.getByRole('button', { name: 'Issue the class' }).click();
  await expect(page.getByRole('heading', { name: `${student.fullName} — Term 1` })).toBeVisible();

  await context.close();
});

test.describe('accessibility', () => {
  test('the pages anyone can reach', async ({ page }) => {
    for (const path of ['/', '/login', '/register']) {
      await page.goto(path);
      await scan(page, path);
    }
  });

  test('a form that has failed, which is when a11y stops being decorative', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@example.test');
    await page.getByLabel('Password').fill('wrong-but-long-enough-to-submit');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The error has to exist before it can be scanned; scanning the page a moment early would
    // check the same clean form the test above already checked.
    await expect(page.getByRole('alert')).toBeVisible();
    await scan(page, '/login with an error');
  });

  test('a pupil’s pages', async ({ page }) => {
    await signIn(page, student.email);

    for (const path of [
      '/home',
      '/social',
      `/classes/${classId}`,
      `/classes/${classId}/marks`,
      `/classes/${classId}/register`,
      `/classes/${classId}/report-cards`,
      '/notifications',
      '/settings/profile',
      '/settings/notifications',
    ]) {
      await page.goto(path);
      await scan(page, path);
    }
  });

  test('a teacher’s pages, including the forms', async ({ page }) => {
    await signIn(page, teacher.email);

    for (const path of [
      '/home',
      `/classes/${classId}/marks`,
      `/classes/${classId}/register`,
      `/classes/${classId}/report-cards`,
      `/classes/${classId}/syllabus`,
    ]) {
      await page.goto(path);
      await scan(page, path);
    }
  });

  test('the school portal', async ({ page }) => {
    await signIn(page, school.email);

    for (const path of [
      '/school',
      '/school/classes',
      `/school/classes/${classId}`,
      '/school/terms',
      '/school/verifications',
      '/school/members',
      '/school/notices',
      '/school/events',
      '/school/billing',
    ]) {
      await page.goto(path);
      await scan(page, path);
    }
  });
});
