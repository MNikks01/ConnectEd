/**
 * Class timetables, driven by a browser (S2-9).
 *
 * This is the first upload in the product, and the first place the browser sends bytes rather than
 * JSON: file → media endpoint → opaque key → attached to the class. The test that matters is that
 * a member of the class can see the resulting image and a non-member cannot.
 */
import { expect, test } from '@playwright/test';

import {
  createClass,
  createSchool,
  createIndividual,
  createSubject,
  verifiedStudentIn,
  type School,
} from './support/accounts';
import { signIn } from './support/auth';

/** The smallest valid PNG: signature plus a 1x1 pixel. Real bytes, because the API checks them. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

  test('a school builds a structured week and its class reads it', async ({ page }) => {
    const { school, classId } = await schoolWithClass('C');
    await createSubject(school, classId, 'Mathematics');
    const student = await verifiedStudentIn(school, classId);

    await signIn(page, school.email);
    await page.goto(`/school/classes/${classId}`);

    // First period: a real subject.
    // `exact` on every one of these: the subjects panel above has a "Subject name" field, and
    // "Subject" matches both. The sixth time this suite has been bitten by a label that is a
    // prefix of another one.
    await page.getByLabel('Day').selectOption('MONDAY');
    await page.getByLabel('Starts').fill('09:00');
    await page.getByLabel('Ends').fill('09:45');
    await page.getByLabel('Subject', { exact: true }).selectOption({ label: 'Mathematics' });
    await page.getByRole('button', { name: 'Add period' }).click();

    // Second: a break, which is why a period is allowed not to be a subject at all.
    await page
      .getByLabel('Subject', { exact: true })
      .selectOption({ label: 'Something else (break, assembly…)' });
    await page.getByLabel('Period name').fill('Break');
    await page.getByLabel('Ends').fill('10:00');
    await page.getByRole('button', { name: 'Add period' }).click();

    await expect(page.getByText('This week (2 periods)')).toBeVisible();
    await page.getByRole('button', { name: 'Publish timetable' }).click();
    await expect(page.getByText('Timetable published.', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.email);
    await page.goto(`/classes/${classId}/timetable`);

    // The grid, not an image: a day heading, the times, and the subject resolved to its name.
    await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible();
    await expect(page.getByText('09:00–09:45')).toBeVisible();
    await expect(page.getByText('Mathematics')).toBeVisible();
    await expect(page.getByText('Break')).toBeVisible();
    // Days nobody teaches are absent entirely rather than shown empty.
    await expect(page.getByRole('heading', { name: 'Sunday' })).toBeHidden();
  });

  test('the server refuses a week that overlaps, and says so', async ({ page }) => {
    const { school, classId } = await schoolWithClass('D');
    await createSubject(school, classId, 'History');

    await signIn(page, school.email);
    await page.goto(`/school/classes/${classId}`);

    for (const [starts, ends] of [
      ['09:00', '10:00'],
      ['09:30', '10:30'],
    ]) {
      await page.getByLabel('Starts').fill(starts ?? '');
      await page.getByLabel('Ends').fill(ends ?? '');
      await page.getByRole('button', { name: 'Add period' }).click();
    }

    await page.getByRole('button', { name: 'Publish timetable' }).click();

    // The browser could have caught this and deliberately does not. The rule lives on the server,
    // where it cannot be skipped, and the message it sends is what the school reads.
    await expect(page.getByText(/overlap/i)).toBeVisible();
  });
});
