import { expect, test } from '@playwright/test';

/**
 * The destination hub is the page intended to rank — individual trips stay
 * noindex until they earn it, so this one carries the SEO weight. That only
 * works if it says something, which is what these assert.
 */
test.describe('destination hubs', () => {
  test('summarises what people actually plan here', async ({ page }) => {
    await page.goto('/destinations/tokyo-jp');

    await expect(page.getByRole('heading', { level: 1, name: 'Tokyo' })).toBeVisible();
    await expect(page.getByText('days, typically')).toBeVisible();
    await expect(page.getByText('typical budget')).toBeVisible();
    await expect(page.getByText(/People come here for/)).toBeVisible();
  });

  test('lists the places that recur across itineraries', async ({ page }) => {
    await page.goto('/destinations/tokyo-jp');
    await expect(page.getByRole('heading', { name: 'Where people actually go' })).toBeVisible();
    await expect(page.getByText('Nezu Shrine')).toBeVisible();
    // Places come from Google, so attribution is required wherever they appear.
    await expect(page.getByText('Place information from Google Maps.')).toBeVisible();
  });

  test('carries a description built from real data, not a template', async ({ page }) => {
    await page.goto('/destinations/tokyo-jp');
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');

    expect(description).toContain('Tokyo');
    expect(description).toMatch(/\d+ days/);
    expect(description).toContain('itinerar');
  });

  test('is canonical, so it does not compete with itself', async ({ page }) => {
    await page.goto('/destinations/tokyo-jp');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/destinations\/tokyo-jp$/,
    );
  });

  test('a destination nobody has planned yet still renders', async ({ page }) => {
    // Havana is seeded with no trips. The stats block must be absent rather
    // than showing zeroes, and the page must still invite someone to plan.
    await page.goto('/destinations/havana-cu');
    await expect(page.getByRole('heading', { level: 1, name: 'Havana' })).toBeVisible();
    await expect(page.getByText('days, typically')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Plan a trip to Havana/ })).toBeVisible();
    await expect(page.getByText(/No public trips here yet/)).toBeVisible();
  });

  test('an unknown destination 404s', async ({ page }) => {
    const response = await page.goto('/destinations/not-a-place');
    expect(response?.status()).toBe(404);
  });
});
