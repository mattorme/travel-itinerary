import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility gate.
 *
 * Runs axe over every page a visitor can reach without an account, at WCAG 2.1
 * AA. This is a merge gate rather than an audit: the cost of fixing a contrast
 * or labelling mistake is trivial the day it is introduced and awful a hundred
 * components later.
 *
 * Violations are reported with their target selectors, because "3 violations"
 * is not actionable and the whole point is that a failure tells you where to
 * look.
 */
async function scan(page: Page, disable: string[] = []) {
  /*
   * Wait for every entrance animation to finish first.
   *
   * axe measures the colour it finds on screen at the instant it runs, and
   * content fading in from zero opacity blends with the background — it will
   * report a contrast failure that stops existing a fraction of a second
   * later. Waiting for the settled state tests what a reader actually holds
   * still and reads, and makes the gate deterministic instead of a race.
   */
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState === 'finished'),
    undefined,
    { timeout: 5000 },
  );

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(disable)
    .analyze();

  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
    why: v.nodes.slice(0, 4).map((n) => (n.failureSummary ?? '').replace(/\n/g, ' ')),
  }));

  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
}

test.describe('accessibility', () => {
  test('the landing page', async ({ page }) => {
    await page.goto('/');
    await scan(page);
  });

  test('explore, including search and filters', async ({ page }) => {
    await page.goto('/explore?q=food&days=week');
    await scan(page);
  });

  test('a public trip page', async ({ page }) => {
    await page.goto('/t/three-slow-days-in-tokyo');
    await scan(page);
  });

  test('a destination hub', async ({ page }) => {
    await page.goto('/destinations/tokyo-jp');
    await scan(page);
  });

  test('a creator profile', async ({ page }) => {
    await page.goto('/u/demo');
    await scan(page);
  });

  test('the trip wizard, on every step', async ({ page }) => {
    await page.goto('/plan');
    await scan(page);

    await page.getByPlaceholder(/Tokyo, Portugal/).fill('Tokyo');
    const advance = page.getByRole('button', { name: /Continue|Build my itinerary/ });

    for (const heading of [
      /When, and for how long/,
      /Who's going/,
      /What's your budget/,
      /How do you like to travel/,
      /What are you into/,
    ]) {
      await advance.click();
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await scan(page);
    }
  });

  test('the share sheet', async ({ page }) => {
    await page.goto('/t/three-slow-days-in-tokyo');
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('dialog', { name: 'Share this trip' })).toBeVisible();
    await scan(page);
  });

  test('sign in', async ({ page }) => {
    await page.goto('/signin');
    await scan(page);
  });

  test('the legal pages', async ({ page }) => {
    for (const path of ['/privacy', '/terms']) {
      await page.goto(path);
      await scan(page);
    }
  });
});
