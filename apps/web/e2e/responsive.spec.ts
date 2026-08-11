/**
 * The product at 320px (S9-17, NFR-011).
 *
 * "No horizontal scroll ≥ 320px" has been in `apps/web/CLAUDE.md` since Sprint 1 and in the TRD as
 * NFR-011 since Sprint 2. Nothing had ever loaded a page at 320px, and the end-to-end suite runs at
 * a desktop viewport where the failure is invisible by construction.
 *
 * **320px is not an arbitrary small number.** It is the narrowest viewport in common use, and on a
 * product whose parents check a register on a phone in the morning it is the ordinary case rather
 * than the edge one.
 *
 * What this asserts is deliberately narrow: the **document is not wider than the window**. A page
 * that overflows horizontally forces a reader to pan sideways to finish a sentence, and it is the
 * one responsive failure that cannot be argued about — everything else (is the tap target big
 * enough, does the table make sense stacked) needs a person.
 */
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

async function expectNoHorizontalOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    // The widest element is worth naming: "the page is 40px too wide" sends somebody hunting,
    // "the marks table is 40px too wide" does not.
    let widest = { tag: 'none', width: 0 };
    for (const element of document.body.querySelectorAll('*')) {
      const width = element.getBoundingClientRect().right;
      if (width > widest.width) {
        widest = {
          tag: `${element.tagName.toLowerCase()}${element.className ? '.' + String(element.className).split(' ')[0] : ''}`,
          width: Math.round(width),
        };
      }
    }
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, widest };
  });

  expect(
    overflow.scrollWidth,
    `${where} scrolls horizontally at ${overflow.clientWidth}px — widest element ${overflow.widest.tag} reaches ${overflow.widest.width}px`,
    // One pixel of slack: sub-pixel layout rounding is not a defect anybody can see.
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

let school: School;
let classId: string;
let teacher: Individual;
let student: Individual;

test.beforeAll(async () => {
  school = await createSchool('narrow');
  const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_4', section: 'A' });
  classId = klass.id;
  ({ teacher } = await verifiedTeacherFor(school, classId, 'Mathematics'));
  await allocateClassTeacher(school, classId, teacher);
  student = await verifiedStudentIn(school, classId, 'pupil');
});

test.describe('at 320px', () => {
  test('the pages anyone can reach do not scroll sideways', async ({ page }) => {
    for (const path of ['/', '/login', '/register']) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page, path);
    }
  });

  test('a pupil’s pages do not scroll sideways', async ({ page }) => {
    await signIn(page, student.email);

    for (const path of [
      '/home',
      '/social',
      `/classes/${classId}`,
      `/classes/${classId}/marks`,
      `/classes/${classId}/register`,
      `/classes/${classId}/report-cards`,
      '/settings/profile',
      '/settings/privacy',
    ]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page, path);
    }
  });

  test('a teacher’s pages do not scroll sideways', async ({ page }) => {
    await signIn(page, teacher.email);

    for (const path of [
      '/home',
      `/classes/${classId}/marks`,
      `/classes/${classId}/register`,
      `/classes/${classId}/report-cards`,
    ]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page, path);
    }
  });

  test('the school portal does not scroll sideways', async ({ page }) => {
    await signIn(page, school.email);

    for (const path of [
      '/school',
      '/school/classes',
      `/school/classes/${classId}`,
      '/school/terms',
      '/school/members',
      '/school/verifications',
      '/school/billing',
    ]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page, path);
    }
  });

  /**
   * A school with **nothing in it**, which the fixture above is not.
   *
   * An empty table is wider than a populated one at this width: the "no classes yet" cell spans
   * every column and does not wrap, where real rows do. The suite had checked only the populated
   * case, so the widest version of this page had never been measured — and it is also the first
   * page a school sees, before it has created anything at all.
   *
   * This is the case that found the grid-track defect: a class table's min-content width made its
   * column 321px inside a 288px page, because a grid item's automatic minimum size is
   * content-based and `overflow-x` on the table's own scroll container cannot shrink its parent.
   *
   * **It does not reproduce on macOS**, and that is worth saying rather than leaving somebody to
   * conclude the test is redundant when it passes locally with the fix reverted. The margin is a
   * handful of pixels and it is decided by font metrics: CI's Linux fonts are wider, the failure
   * is real there, and it had already gone red on `development` twice before anybody looked. The
   * same shape as S9-17's WebKit cookie — an environment-dependent defect the machine it was
   * written on cannot see.
   */
  test('a school with no classes yet does not scroll sideways', async ({ page }) => {
    const empty = await createSchool('emptyportal');

    await signIn(page, empty.email);
    await page.goto('/school/classes');

    await expectNoHorizontalOverflow(page, '/school/classes with no classes');
  });
});
