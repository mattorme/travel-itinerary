import { expect, test } from '@playwright/test';

const DEMO = '/t/three-slow-days-in-tokyo';

/**
 * The loop the whole product is built around:
 *
 *   share → view (logged out) → "Make this trip yours" → own editable copy
 *
 * The clone must succeed without a sign-up wall. If it ever does not, the
 * retention loop is broken regardless of how good the itineraries are.
 */
test.describe('the clone loop', () => {
  test('a logged-out visitor can read the whole itinerary', async ({ page }) => {
    await page.goto(DEMO);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Three slow days in Tokyo');
    await expect(page.getByText(/excl\. flights/)).toBeVisible();

    // All three days, with real content, not a teaser.
    for (const day of [1, 2, 3]) {
      await expect(page.locator(`#day-${day}`)).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Yanaka Cemetery walk' })).toBeVisible();

    // Never a sign-in wall on a shared link.
    await expect(page).not.toHaveURL(/signin/);
  });

  test('costs are always presented as estimates', async ({ page }) => {
    // Google supplies price levels, not prices. Every figure here is modelled by
    // us, and the UI must never imply otherwise.
    await page.goto(DEMO);
    await expect(page.getByText(/Estimates based on typical prices/)).toBeVisible();
    await expect(page.getByText(/excl\. flights/).first()).toBeVisible();
  });

  test('a logged-out visitor can make the trip theirs in one tap', async ({ page }) => {
    await page.goto(DEMO);

    const cta = page.getByRole('button', { name: 'Make this trip yours' });
    await expect(cta).toBeVisible();
    await cta.click();

    // Lands on their own copy, not a sign-up page.
    await page.waitForURL(/\/t\/[a-z0-9-]+/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(new RegExp(`${DEMO}$`));
    await expect(page).not.toHaveURL(/signin/);

    // The copy is theirs to edit, and credits the original.
    await expect(page.getByRole('button', { name: 'Edit this trip' })).toBeVisible();
    await expect(page.getByText(/Based on a trip by/)).toBeVisible();
    await expect(page.getByText('@demo')).toBeVisible();

    // And it is a real copy, not a redirect to the same trip.
    await expect(page.getByRole('heading', { name: 'Yanaka Cemetery walk' })).toBeVisible();
  });

  test('the share sheet offers a link anyone can open', async ({ page }) => {
    await page.goto(DEMO);
    await page.getByRole('button', { name: 'Share' }).click();

    const dialog = page.getByRole('dialog', { name: 'Share this trip' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/no account needed/i)).toBeVisible();
    await expect(dialog.getByText(new RegExp(DEMO))).toBeVisible();
    await expect(dialog.getByRole('link', { name: /story graphic/i })).toBeVisible();
  });

  test('the trip renders correctly with no cached Google content', async ({ page }) => {
    // The seeded trip deliberately has no place references, so this exercises
    // the cold-cache path: authored titles must carry the page on their own.
    await page.goto(DEMO);
    await expect(page.getByRole('heading', { name: 'Nezu Shrine' })).toBeVisible();
    await expect(page.getByText(/12 min walk/)).toBeVisible();
  });

  test('share metadata is complete enough to paste into a chat', async ({ page }) => {
    await page.goto(DEMO);

    const ogTitle = page.locator('meta[property="og:title"]');
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogTitle).toHaveAttribute('content', /Three slow days in Tokyo/);
    await expect(ogImage).toHaveAttribute('content', /opengraph-image/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
  });
});
