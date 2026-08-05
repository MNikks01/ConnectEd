/**
 * Interactions that survive hydration.
 *
 * A button in a client component is present, visible, and enabled in the server-rendered HTML
 * *before* React attaches its listener. Playwright's actionability checks are satisfied by that
 * HTML, so a click can land in the gap and be dropped silently — no request, no error, nothing to
 * assert on. It never reproduces on a developer laptop and shows up on a two-core CI runner, which
 * is the worst possible distribution for a flake.
 *
 * `clickUntil` re-clicks only while the button is still there to be clicked. That distinction
 * matters: a blind retry loop would toggle a control back off if the first click did land but the
 * re-render was merely slow.
 */
import { expect, type Locator } from '@playwright/test';

export async function clickUntil(
  button: Locator,
  settled: () => Promise<void>,
  timeout = 20_000,
): Promise<void> {
  /**
   * The state as of the last attempt, captured *inside* the loop.
   *
   * Not afterwards: `toPass` expiring often coincides with the test's own budget expiring, and by
   * then the page is being torn down and every query returns nothing. The first attempt at these
   * forensics reported "(no body)" for exactly that reason.
   */
  let lastSeen = '(nothing recorded)';

  await expect(async () => {
    // Gone *or disabled* means the click landed and the UI moved on; only wait for the outcome.
    //
    // `isVisible` alone was not enough. A button mid-action is disabled and still visible, and
    // `click()` on a disabled button waits for it to re-enable — which never happens when the
    // action removes it. That click can absorb the whole budget, and the failure then reports the
    // outcome assertion rather than the wait that actually expired.
    const clickable = (await button.isVisible()) && (await button.isEnabled());

    // Bounded, so a button that becomes unactionable between the check and the click cannot eat
    // the remaining time either. A failure here just retries the whole callback.
    if (clickable) await button.click({ timeout: 2_000 });

    try {
      await settled();
    } catch (error) {
      lastSeen = await describe(button, clickable);
      throw error;
    }
  })
    .toPass({ timeout })
    .catch((error: unknown) => {
      // A timeout otherwise reports the *outcome* assertion, which says what did not happen and
      // nothing about why. Three CI failures of one test produced three identical messages and no
      // evidence between them.
      throw new Error(`${String(error)}\n\n${lastSeen}`);
    });
}

/** What the page looked like on the last attempt. Never throws; a broken forensic is not a bug. */
async function describe(button: Locator, clickable: boolean): Promise<string> {
  const page = button.page();
  const text = async (locator: Locator, fallback: string) =>
    (await locator.innerText({ timeout: 1_000 }).catch(() => fallback)).replace(/\s+/g, ' ').trim();

  return [
    '── clickUntil forensics (last attempt) ────────────────────────────',
    `  button:  clickable=${String(clickable)}`,
    `  dialog:  ${(await text(page.getByRole('dialog'), '(none)')).slice(0, 200)}`,
    `  alert:   ${(await text(page.getByRole('alert').first(), '(none)')).slice(0, 200)}`,
    `  page:    ${(await text(page.locator('main').first(), '(none)')).slice(0, 400)}`,
    '───────────────────────────────────────────────────────────────────',
  ].join('\n');
}
