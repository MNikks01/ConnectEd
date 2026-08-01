/**
 * Class timetables, driven by a browser (S2-9).
 *
 * This is the first upload in the product, and the first place the browser sends bytes rather than
 * JSON: file → media endpoint → opaque key → attached to the class. The test that matters is that
 * a member of the class can see the resulting image and a non-member cannot.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  createClass,
  createSchool,
  createIndividual,
  PASSWORD,
  verifiedStudentIn,
  type School,
} from './support/accounts';

/** The smallest valid PNG: signature plus a 1x1 pixel. Real bytes, because the API checks them. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/home');
}

async function schoolWithClass(section: string): Promise<{ school: School; classId: string }> {
  const school = await createSchool('timetable');
  const klass = await createClass(school, { medium: 'ENGLISH', level: 'CLASS_6', section });
  return { school, classId: klass.id };
}

test.describe('timetable', () => {
  test('a school uploads one and its class sees it', async ({ page }) => {
    const { school, classId } = await schoolWithClass('A');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, school.email);
    await page.goto(`/school/classes/${classId}`);
    await expect(page.getByText('No timetable yet.')).toBeVisible();

    await page.getByLabel('Timetable image').setInputFiles({
      name: 'timetable.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    });
    await page.getByRole('button', { name: 'Upload timetable' }).click();

    await expect(page.getByText('Timetable uploaded.')).toBeVisible();
    await expect(page.getByRole('img', { name: /version 1/i })).toBeVisible();

    // Now the student.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);

    await page.goto(`/classes/${classId}`);
    await page.getByRole('link', { name: 'Timetable' }).click();

    await expect(page).toHaveURL(`/classes/${classId}/timetable`);
    const image = page.getByRole('img', { name: /timetable/i });
    await expect(image).toBeVisible();

    // The signed URL must actually resolve — a broken image would still be "visible".
    const src = await image.getAttribute('src');
    expect(src).toContain('http');
    const fetched = await page.request.get(src ?? '');
    expect(fetched.status()).toBe(200);
  });

  test('uploading again supersedes the previous version', async ({ page }) => {
    const { school, classId } = await schoolWithClass('B');

    await signIn(page, school.email);
    await page.goto(`/school/classes/${classId}`);

    // Each round waits for the *version* to change, not for the success message: the message from
    // the first upload is still on screen when the second starts, so waiting on it would pass
    // instantly and race the re-render.
    for (const version of [1, 2]) {
      await page.getByLabel('Timetable image').setInputFiles({
        name: 'timetable.png',
        mimeType: 'image/png',
        buffer: PNG_1X1,
      });
      await page.getByRole('button', { name: 'Upload timetable' }).click();

      await expect(
        page.getByRole('img', { name: new RegExp(`version ${version}`, 'i') }),
      ).toBeVisible();
    }
  });

  test('a non-member cannot reach it by guessing the URL', async ({ page }) => {
    const { school, classId } = await schoolWithClass('C');
    await verifiedStudentIn(school, classId);
    const outsider = await createIndividual('nosytt');

    await signIn(page, outsider.email);
    await page.goto(`/classes/${classId}/timetable`);

    await expect(page.getByText('404')).toBeVisible();
  });

  test('a member sees a plain message when nothing has been uploaded', async ({ page }) => {
    const { school, classId } = await schoolWithClass('D');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, student.email);
    await page.goto(`/classes/${classId}/timetable`);

    await expect(
      page.getByText('Your school has not uploaded a timetable for this class yet.'),
    ).toBeVisible();
  });
});
