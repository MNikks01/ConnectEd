/**
 * Signing in, once, for every spec.
 *
 * The wait at the end matters more than it looks. `toHaveURL` is satisfied the moment the browser
 * commits the navigation, while `/home` is still streaming — it now assembles a dashboard from
 * several authorized requests. A test that navigates away at that point aborts a render in flight,
 * and on a two-core CI runner the next interaction lands on a server still finishing the last one.
 * Waiting for the greeting means every test starts from a page that is actually done.
 */
import { expect, type Page } from '@playwright/test';

import { PASSWORD } from './accounts';

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/home');
  await expect(page.getByRole('heading', { name: /^Hello,/ })).toBeVisible();
}
