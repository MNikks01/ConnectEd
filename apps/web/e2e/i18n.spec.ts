/**
 * Switching language — S9-18 (NFR-016, ADR-0021).
 *
 * Every other test in this suite asserts on English copy, which means the whole of them would stay
 * green if the Hindi catalogue were empty, wrong, or never loaded. This is the one spec that would
 * not, and it is the reason it exists: a translation nothing exercises is a claim, not a feature.
 *
 * It asserts three things, and the third is the one most likely to be forgotten:
 *
 * 1. the choice changes the words,
 * 2. it **survives a navigation** — a language that resets on the next page is not a setting,
 * 3. `<html lang>` follows it. That attribute is what tells a screen reader which voice to use, and
 *    Hindi read aloud by an English synthesiser is not accented, it is unintelligible.
 */
import { expect, test } from '@playwright/test';

import { createIndividual } from './support/accounts';
import { signIn } from './support/auth';

test.describe('language', () => {
  test('a visitor can read the sign-in page in Hindi', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // The option is labelled in its own language — somebody looking for Hindi is not reading the
    // English word for it.
    await page.getByLabel('Change language').selectOption('hi');

    await expect(page.getByRole('heading', { name: 'साइन इन करें' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    // Nothing on the page is a leftover English string from a component that forgot to translate.
    await expect(page.getByText('Welcome back to GetConnected.')).toHaveCount(0);
  });

  test('the choice survives navigation while signed out', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Change language').selectOption('hi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    // A different page: the cookie is the whole mechanism, and this is where a per-page state
    // would show itself.
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'खाता बनाएँ' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  });

  test('a signed-in person can switch, and the shell follows', async ({ page }) => {
    const person = await createIndividual('hindi');

    await signIn(page, person.email);
    await page.goto('/settings/privacy');

    // Reachable from settings. Until this spec looked, the switcher existed only on the pages you
    // see *before* signing in — so anybody who chose wrongly had no way back.
    await page.getByLabel('Change language').selectOption('hi');

    // The page, and the navigation around it, which is a different component tree entirely.
    await expect(page.getByRole('heading', { name: 'आपका डेटा', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'एक प्रति माँगें' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'होम' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    await page.goto('/home');
    await expect(page.getByRole('link', { name: 'सामुदायिक' })).toBeVisible();
  });

  test('switching back is one step, from a page nobody can read', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Change language').selectOption('hi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    // The switcher is labelled in the current language once it has changed, so this is the reverse
    // trip a person makes if they picked the wrong one: one control, still findable.
    await page.getByLabel('भाषा बदलें').selectOption('en');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
