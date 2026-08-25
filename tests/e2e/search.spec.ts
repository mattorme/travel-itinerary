import { expect, test } from '@playwright/test';

/**
 * Search on Explore.
 *
 * Filters are links rather than client state, so every combination is a real
 * URL — shareable, bookmarkable, and reachable with the back button. These
 * tests lean on that.
 */
test.describe('searching trips', () => {
  test('finds a trip by its destination', async ({ page }) => {
    await page.goto('/explore');
    await page.getByLabel('Search trips').fill('Tokyo');
    await page.getByLabel('Search trips').press('Enter');

    await page.waitForURL(/q=Tokyo/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tokyo');
    await expect(page.getByRole('link', { name: /Three slow days in Tokyo/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Lisbon on foot/ })).toHaveCount(0);
  });

  test('finds trips by what you want to do there', async ({ page }) => {
    await page.goto('/explore?q=food');
    // 'food' is an interest on all three seeded trips, so this proves the
    // interests array is in the search vector rather than only the title.
    const cards = page.locator('a[href^="/t/"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(1);
  });

  test('offers to plan the trip when nothing matches', async ({ page }) => {
    await page.goto('/explore?q=zzzznowhere');
    await expect(page.getByText('Nothing matched that')).toBeVisible();
    await expect(page.getByRole('link', { name: /Plan a trip to zzzznowhere/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clear search' })).toBeVisible();
  });

  test('clearing the search restores everything', async ({ page }) => {
    await page.goto('/explore?q=Tokyo');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await page.waitForURL((url) => !url.searchParams.has('q'));
    expect(await page.locator('a[href^="/t/"]').count()).toBeGreaterThan(1);
  });

  test('filters are shareable URLs and combine with search', async ({ page }) => {
    await page.goto('/explore?q=food&days=week');
    // Applied filters are listed so they can be removed one at a time.
    await expect(page.getByLabel('Active filters').getByText('About a week')).toBeVisible();

    const cards = page.locator('a[href^="/t/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    // Every result must actually be in the band.
    for (let i = 0; i < count; i++) {
      const label = await cards.nth(i).innerText();
      const days = Number(/(\d+)\s+days?/.exec(label)?.[1] ?? 0);
      expect(days).toBeGreaterThanOrEqual(5);
      expect(days).toBeLessThanOrEqual(9);
    }
  });

  test('the back button returns to the previous search', async ({ page }) => {
    await page.goto('/explore?q=Tokyo');
    await page.getByLabel('Search trips').fill('Lisbon');
    await page.getByLabel('Search trips').press('Enter');
    await page.waitForURL(/q=Lisbon/);

    await page.goBack();
    await page.waitForURL(/q=Tokyo/);
    // The box has to follow the URL, not keep the value that was typed.
    await expect(page.getByLabel('Search trips')).toHaveValue('Tokyo');
  });

  test('best match only appears when there is something to match', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByRole('link', { name: 'Best match' })).toHaveCount(0);
    await page.goto('/explore?q=food');
    await expect(page.getByRole('link', { name: 'Best match' })).toBeVisible();
  });
});
