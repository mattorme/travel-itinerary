import { expect, test } from '@playwright/test';

const DEMO = '/t/three-slow-days-in-tokyo';

test.describe('imagery', () => {
  test('a trip without a photograph still has a cover', async ({ page }) => {
    // The generated fallback is the difference between "no key configured" and
    // "this product looks broken".
    await page.goto(DEMO);
    const cover = page.locator('svg[role="img"]').first();
    await expect(cover).toBeVisible();
    await expect(cover.locator('title')).toHaveText(/Tokyo/);
  });

  test('cards in a grid all carry a cover', async ({ page }) => {
    await page.goto('/explore');
    const cards = page.locator('a[href^="/t/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator('svg[role="img"], img').first()).toBeVisible();
    }
  });

  test('the same trip gets the same cover on every render', async ({ page }) => {
    await page.goto('/explore');
    // role="img" distinguishes the cover from the decorative icons on the card.
    const cover = page.locator('a[href^="/t/"]').first().locator('svg[role="img"]');
    const first = await cover.innerHTML();
    await page.reload();
    const second = await cover.innerHTML();
    expect(first).toBe(second);
  });
});

test.describe('the itinerary map', () => {
  test('is hidden, with a reason, when no Maps key is configured', async ({ page }) => {
    // Google's terms forbid rendering Places content on a non-Google map, so
    // there is deliberately no substitute. This asserts the decision holds.
    await page.goto(DEMO);
    await expect(page.getByText('Map hidden')).toBeVisible();
    await expect(page.getByText(/non-Google map/)).toBeVisible();
  });
});

/**
 * The save and like buttons update optimistically, so the visible state flips
 * before the server action has finished. Waiting on the auth cookie is the
 * honest signal that the anonymous session actually exists — asserting on the
 * button alone races the write.
 */
async function waitForSession(context: import('@playwright/test').BrowserContext) {
  await expect
    .poll(async () => (await context.cookies()).some((c) => c.name.startsWith('sb-')), {
      timeout: 10_000,
    })
    .toBe(true);
}

test.describe('social', () => {
  test('a visitor can save a trip without an account', async ({ page, context }) => {
    await page.goto(DEMO);
    const save = page.getByRole('button', { name: 'Save this trip' });
    await expect(save).toBeVisible();
    await save.click();
    await expect(page.getByRole('button', { name: 'Remove from saved' })).toBeVisible();
    await waitForSession(context);

    await page.goto('/me/saved');
    await expect(page.getByRole('heading', { name: 'Saved' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Three slow days in Tokyo/ })).toBeVisible();
  });

  test('comments are readable by anyone but need an account to write', async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.getByText(/Yanaka morning is exactly right/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();
    await expect(page.getByPlaceholder(/Been here/)).toHaveCount(0);
  });

  test('a profile shows its counts and a follow button', async ({ page }) => {
    await page.goto('/u/demo');
    await expect(page.getByRole('heading', { name: 'Demo Traveller' })).toBeVisible();
    await expect(page.getByText('followers', { exact: true })).toBeVisible();
    await expect(page.getByText('following', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Follow' })).toBeVisible();
  });

  test('following refuses an anonymous session with a readable message', async ({ page, context }) => {
    // The database enforces this; the UI has to explain it rather than fail
    // silently or show a raw error.
    await page.goto(DEMO);
    await page.getByRole('button', { name: 'Save this trip' }).click(); // creates an anon session
    await waitForSession(context);
    await page.goto('/u/sam');
    await page.getByRole('button', { name: 'Follow' }).click();
    await expect(page.getByText(/Create an account to follow/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Follow' })).toBeVisible();
  });

  test('like counts persist across a reload', async ({ page, context }) => {
    await page.goto(DEMO);
    await page.getByRole('button', { name: 'Like this trip' }).click();
    await expect(page.getByRole('button', { name: 'Remove like' })).toBeVisible();
    await waitForSession(context);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Remove like' })).toBeVisible();
  });
});
