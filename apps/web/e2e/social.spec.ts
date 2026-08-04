/**
 * Social, driven by a browser (S4-9).
 *
 * The chain worth walking is the one nothing below the browser can assert: two people who have
 * never been near a school find each other, post, connect, message, and — the part that matters
 * most in a product used by children — block and report.
 */
import { expect, test } from '@playwright/test';

import { createIndividual, createSchool } from './support/accounts';
import { signIn } from './support/auth';

test.describe('posting and the feed', () => {
  test('a follower sees a post, likes it, and comments', async ({ page }) => {
    const author = await createIndividual('author');
    const reader = await createIndividual('reader');

    await signIn(page, author.email);
    await page.goto('/social');
    await page.getByLabel('Say something').fill('First day back after half term.');
    await page.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByText('Posted.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, reader.email);

    // Nothing followed yet, so the feed says so rather than showing an empty box.
    await page.goto('/social');
    await expect(page.getByText('Nothing here yet.')).toBeVisible();

    await page.goto(`/accounts/${author.accountId}`);
    await expect(page.getByText('First day back after half term.')).toBeVisible();
    await page.getByRole('button', { name: 'Follow' }).click();
    await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible();

    await page.goto('/social');
    await expect(page.getByText('First day back after half term.')).toBeVisible();

    await page.getByRole('button', { name: 'Like' }).click();
    await expect(page.getByRole('button', { name: /Liked, 1/ })).toBeVisible();

    await page.getByRole('button', { name: /Comments/ }).click();
    await page.getByLabel('Add a comment').fill('Welcome back!');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(page.getByText('Comment added.')).toBeVisible();
  });

  test('only the author is offered delete', async ({ page }) => {
    const author = await createIndividual('owner');
    const other = await createIndividual('visitor');

    await signIn(page, author.email);
    await page.goto('/social');
    await page.getByLabel('Say something').fill('Mine to delete.');
    await page.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, other.email);
    await page.goto(`/accounts/${author.accountId}`);

    await expect(page.getByText('Mine to delete.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeHidden();
    // What a non-author gets instead.
    await expect(page.getByRole('button', { name: 'Report' }).first()).toBeVisible();
  });
});

test.describe('profiles', () => {
  test('a member edits their profile and hides the details', async ({ page }) => {
    const person = await createIndividual('editor');
    const stranger = await createIndividual('stranger');

    await signIn(page, person.email);
    await page.goto('/settings/profile');

    await page.getByLabel('About you').fill('Plays the cello.');
    await page.getByLabel('Who can see the details above').selectOption('CONNECTIONS');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile updated.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, stranger.email);
    await page.goto(`/accounts/${person.accountId}`);

    // The card is still there — a profile nobody can find is a profile nobody can connect with.
    await expect(page.getByRole('heading', { name: 'E2E editor' })).toBeVisible();
    await expect(page.getByText('only visible to their connections')).toBeVisible();
    await expect(page.getByText('Plays the cello.')).toBeHidden();
  });

  test('anyone can see a school without being verified', async ({ page }) => {
    const school = await createSchool('public');
    const stranger = await createIndividual('curious');

    await signIn(page, stranger.email);
    await page.goto(`/accounts/${school.accountId}`);

    await expect(page.getByRole('heading', { name: school.name })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Follow' })).toBeVisible();
  });
});

test.describe('connections and messages', () => {
  test('a request is answered by the other party, then they message', async ({ page }) => {
    const asker = await createIndividual('asker');
    const answerer = await createIndividual('answerer');

    await signIn(page, asker.email);
    await page.goto(`/accounts/${answerer.accountId}`);
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByRole('button', { name: 'Request sent' })).toBeVisible();

    await page.goto('/connections');
    await expect(page.getByRole('heading', { name: 'Waiting on them' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, answerer.email);
    await page.goto('/connections');

    await expect(page.getByRole('heading', { name: 'Waiting on you' })).toBeVisible();
    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByText('Connected').first()).toBeVisible();

    // And now a conversation.
    await page.goto(`/accounts/${asker.accountId}`);
    await page.getByRole('button', { name: 'Message' }).click();
    await expect(page).toHaveURL('/messages');

    await page.getByRole('link', { name: 'E2E asker' }).click();
    await page.getByRole('textbox', { name: 'Message' }).fill('Thanks for connecting.');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Sent.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, asker.email);
    await page.goto('/messages');

    await expect(page.getByText('1 unread').first()).toBeVisible();
    await page.getByRole('link', { name: 'E2E answerer' }).click();
    await expect(page.getByText('Thanks for connecting.')).toBeVisible();

    // Opening it is the read.
    await page.goto('/messages');
    await expect(page.getByText('Nothing unread.')).toBeVisible();
  });
});

test.describe('safety', () => {
  test('blocking hides both ways and unblocking puts it back', async ({ page }) => {
    const blocker = await createIndividual('blocker');
    const blocked = await createIndividual('blocked');

    await signIn(page, blocked.email);
    await page.goto('/social');
    await page.getByLabel('Say something').fill('Something the blocker will stop seeing.');
    await page.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByText('Posted.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, blocker.email);
    await page.goto(`/accounts/${blocked.accountId}`);
    await page.getByRole('button', { name: 'Follow' }).click();

    await page.goto('/social');
    await expect(page.getByText('Something the blocker will stop seeing.')).toBeVisible();

    await page.goto(`/accounts/${blocked.accountId}`);
    await page.getByRole('button', { name: 'Block' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('in either direction');
    await dialog.getByRole('button', { name: 'Block' }).click();

    await expect(page.getByText('You have blocked this account.')).toBeVisible();

    await page.goto('/social');
    await expect(page.getByText('Something the blocker will stop seeing.')).toBeHidden();

    // Unblocking restores rather than clears — the follow survived the block.
    await page.goto(`/accounts/${blocked.accountId}`);
    await page.getByRole('button', { name: 'Unblock' }).click();
    await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible();

    await page.goto('/social');
    await expect(page.getByText('Something the blocker will stop seeing.')).toBeVisible();
  });

  test('a member can report a post, and is told nobody at their school sees it', async ({
    page,
  }) => {
    const author = await createIndividual('poster');
    const reporter = await createIndividual('reporter');

    await signIn(page, author.email);
    await page.goto('/social');
    await page.getByLabel('Say something').fill('Something objectionable.');
    await page.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByText('Posted.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, reporter.email);
    await page.goto(`/accounts/${author.accountId}`);

    // The post's own Report, not the profile-level one — they ask different questions.
    await page.getByRole('article').getByRole('button', { name: 'Report' }).click();
    await page.getByLabel('What is wrong with this?').fill('This is not appropriate.');
    await page.getByRole('button', { name: 'Send report' }).click();

    await expect(page.getByText('Nobody at your school is told.')).toBeVisible();
  });
});

test.describe('live delivery', () => {
  test('a message appears without the recipient navigating', async ({ browser }) => {
    const sender = await createIndividual('livesender');
    const recipient = await createIndividual('liverecipient');

    // Two contexts, because this is a claim about two people at once and a single page cannot
    // make it. Anything less than a second browser is asserting the code rather than the product.
    const senderContext = await browser.newContext();
    const recipientContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    const recipientPage = await recipientContext.newPage();

    try {
      await signIn(senderPage, sender.email);
      await signIn(recipientPage, recipient.email);

      await senderPage.goto(`/accounts/${recipient.accountId}`);
      await senderPage.getByRole('button', { name: 'Message' }).click();
      await expect(senderPage).toHaveURL('/messages');
      await senderPage.getByRole('link', { name: 'E2E liverecipient' }).click();

      // The recipient sits on their inbox and does nothing at all from here on.
      await recipientPage.goto('/messages');
      await expect(recipientPage.getByText('Nothing unread.')).toBeVisible();

      await senderPage.getByRole('textbox', { name: 'Message' }).fill('Are you there?');
      await senderPage.getByRole('button', { name: 'Send' }).click();
      await expect(senderPage.getByText('Sent.')).toBeVisible();

      // No reload, no click. If the websocket never connects this fails, and it fails here rather
      // than in a way that looks like slow polling.
      //
      // `.first()` because the count lands in two places at once — the page description and the
      // thread's badge — and both updating is the point rather than an accident.
      await expect(recipientPage.getByText('1 unread').first()).toBeVisible({ timeout: 10_000 });
      await expect(recipientPage.getByText('Are you there?')).toBeVisible();
    } finally {
      await senderContext.close();
      await recipientContext.close();
    }
  });
});
