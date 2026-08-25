import { expect, test } from '@playwright/test';

/**
 * The legal pages are linked from the footer of every page, so an empty
 * placeholder is visible on every route in the product.
 */
test.describe('legal pages', () => {
  for (const [path, heading] of [
    ['/privacy', 'Privacy'],
    ['/terms', 'Terms'],
  ] as const) {
    test(`${path} has real content and says it needs review`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

      // The banner is part of the component, not the prose, so it cannot be
      // removed by editing copy. It should only go when a lawyer signs off.
      await expect(page.getByRole('note')).toContainText('Not yet reviewed by a lawyer');

      // Guards against the placeholder these replaced.
      await expect(page.getByText('has not been written yet')).toHaveCount(0);
      expect((await page.locator('main').innerText()).length).toBeGreaterThan(1200);
    });
  }

  test('both are reachable from the footer of any page', async ({ page }) => {
    await page.goto('/t/three-slow-days-in-tokyo');
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await page.getByRole('link', { name: 'Privacy' }).click();
    await page.waitForURL(/\/privacy/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy');
  });

  test('the privacy page describes the anonymous session behaviour', async ({ page }) => {
    // This is the least obvious thing the product does with data, and the most
    // important to state plainly.
    await page.goto('/privacy');
    const body = await page.locator('main').innerText();
    expect(body).toContain('without an account');
    expect(body).toContain('one-way hash');
  });
});
