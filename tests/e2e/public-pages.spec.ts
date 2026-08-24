import { expect, test } from '@playwright/test';

/** The pages a logged-out visitor can reach, and the ones they cannot. */
test.describe('public surfaces', () => {
  test('explore renders without an account', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByRole('heading', { name: 'Trips worth copying' })).toBeVisible();
  });

  test('destinations list the seeded cities', async ({ page }) => {
    await page.goto('/destinations');
    await expect(page.getByRole('heading', { name: 'Destinations' })).toBeVisible();
  });

  test('a destination hub offers to plan a trip there', async ({ page }) => {
    await page.goto('/destinations/tokyo-jp');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tokyo');
    await expect(page.getByRole('link', { name: /Plan a trip to Tokyo/ })).toBeVisible();
  });

  test('an unknown trip slug 404s rather than erroring', async ({ page }) => {
    const response = await page.goto('/t/definitely-not-a-real-trip');
    expect(response?.status()).toBe(404);
  });

  test('the owner area redirects a signed-out visitor to sign in', async ({ page }) => {
    await page.goto('/me');
    await expect(page).toHaveURL(/\/signin/);
  });

  test('robots keeps crawlers out of the private areas', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    const body = (await response?.text()) ?? '';
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Disallow: /trips/');
    expect(body).toContain('Sitemap:');
  });
});
