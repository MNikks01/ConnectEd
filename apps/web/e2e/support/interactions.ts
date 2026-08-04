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

    await settled();
  }).toPass({ timeout });
}
