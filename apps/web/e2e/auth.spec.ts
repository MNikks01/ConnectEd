/**
 * Authentication, driven by a browser.
 *
 * These assert the things unit and integration tests structurally cannot: that the cookie the API
 * sets is one this browser will send back, that a redirect chain terminates, and that no token
 * reaches client-readable storage.
 */
import { expect, test } from '@playwright/test';

import { createIndividual, createSchool, PASSWORD } from './support/accounts';

test.describe('registration and sign-in', () => {
  test('a visitor can register and lands signed in', async ({ page }) => {
    const slug = `signup-${Date.now()}`;

    await page.goto('/register');
    await page.getByLabel('Full name').fill('New Person');
    await page.getByLabel('Handle').fill(slug.replace(/-/g, '.'));
    await page.getByLabel('Email').fill(`${slug}@e2e.test`);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL('/home');
    await expect(page.getByRole('heading', { name: 'Hello, New Person' })).toBeVisible();
    await expect(page.getByText(`${slug}@e2e.test`)).toBeVisible();
  });

  test('an existing member can sign in', async ({ page }) => {
    const person = await createIndividual('login');

    await page.goto('/login');
    await page.getByLabel('Email').fill(person.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/home');
    await expect(page.getByText(person.email)).toBeVisible();
  });

  test('a wrong password shows the error and stays on the page', async ({ page }) => {
    const person = await createIndividual('badpass');

    await page.goto('/login');
    await page.getByLabel('Email').fill(person.email);
    await page.getByLabel('Password').fill('not the right password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Scoped to the form: Next renders a route announcer that also has role="alert".
    await expect(page.locator('form').getByRole('alert')).toContainText(
      'Email or password is incorrect',
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test('a short password is rejected by the shared schema before the API is called', async ({
    page,
  }) => {
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Too Short');
    await page.getByLabel('Handle').fill(`short.${Date.now()}`);
    await page.getByLabel('Email').fill(`short-${Date.now()}@e2e.test`);
    await page.getByLabel('Password').fill('tooshort');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Password must be at least 12 characters.')).toBeVisible();
  });
});

test.describe('session handling', () => {
  test('session cookies are httpOnly and unreadable from script', async ({ page, context }) => {
    const person = await createIndividual('cookies');

    await page.goto('/login');
    await page.getByLabel('Email').fill(person.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/home');

    const cookies = await context.cookies();
    const session = cookies.filter((cookie) => cookie.name.startsWith('connected_'));

    expect(session.length).toBeGreaterThanOrEqual(2);
    for (const cookie of session) {
      expect(cookie.httpOnly, `${cookie.name} must be httpOnly`).toBe(true);
      expect(cookie.sameSite).toBe('Lax');
    }

    // The decisive check: an XSS payload would run exactly this and must come back empty.
    const readable = await page.evaluate(() => document.cookie);
    expect(readable).not.toContain('connected_access');
    expect(readable).not.toContain('connected_refresh');
  });

  test('no access token appears in the rendered page', async ({ page }) => {
    const person = await createIndividual('notoken');

    await page.goto('/login');
    await page.getByLabel('Email').fill(person.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/home');

    // JWTs all start with this once base64url-encoded.
    expect(await page.content()).not.toContain('eyJhbGciOi');
  });

  test('signing out ends the session and protected pages redirect', async ({ page }) => {
    const person = await createIndividual('logout');

    await page.goto('/login');
    await page.getByLabel('Email').fill(person.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/home');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/home');
    await expect(page).toHaveURL(/\/login/);
  });

  test('a signed-out visitor is redirected away from a protected page', async ({ page }) => {
    await page.goto('/home');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('school accounts are web-only', () => {
  test('a school can sign in on the web and reaches its portal', async ({ page }) => {
    const school = await createSchool('weblogin');

    await page.goto('/login');
    await page.getByLabel('Email').fill(school.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/home');
    await expect(page.getByText('signed in as an institution')).toBeVisible();
  });
});
