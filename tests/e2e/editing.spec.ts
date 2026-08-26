import { expect, test } from '@playwright/test';
import { openOwnedTrip } from './support/trip';

/**
 * Editing, from the traveller's side.
 *
 * Reaches an owned trip the way a real user does — by cloning a public one —
 * so this also covers that a clone is genuinely editable rather than a
 * read-only copy.
 */
test.describe('editing an owned trip', () => {
  test('an owner can reorder and remove stops', async ({ page }) => {
    await page.goto('/t/three-slow-days-in-tokyo');
    await page.getByRole('button', { name: 'Make this trip yours' }).click();
    await page.waitForURL(/\/t\/[a-z0-9-]+/, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Edit this trip' }).click();
    await page.waitForURL(/\/trips\/[0-9a-f-]+/, { timeout: 20_000 });

    const firstDay = page.locator('#day-1');
    await expect(firstDay).toBeVisible();

    const before = await firstDay.locator('article h3').allInnerTexts();
    expect(before.length).toBeGreaterThan(2);

    // The first stop cannot move earlier; the second can.
    const moveEarlier = firstDay.getByRole('button', { name: 'Move earlier' });
    await expect(moveEarlier.first()).toBeDisabled();
    await moveEarlier.nth(1).click();

    await expect(async () => {
      const after = await firstDay.locator('article h3').allInnerTexts();
      expect(after[0]).toBe(before[1]);
    }).toPass({ timeout: 15_000 });

    // Removing asks first — a destructive action should not be one stray tap.
    await firstDay.getByRole('button', { name: 'Remove' }).first().click();
    await expect(firstDay.getByRole('button', { name: 'Remove it' })).toBeVisible();
    await firstDay.getByRole('button', { name: 'Remove it' }).click();

    await expect(async () => {
      const after = await firstDay.locator('article h3').allInnerTexts();
      expect(after.length).toBe(before.length - 1);
    }).toPass({ timeout: 15_000 });
  });

  test('an owner can pin a stop so it stays put', async ({ page }) => {
    await openOwnedTrip(page);

    const pin = page.locator('#day-1').getByRole('button', { name: 'Pin' }).first();
    await pin.click();

    await expect(page.locator('#day-1').getByRole('button', { name: 'Pinned' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/we won't move this when the day changes/i).first()).toBeVisible();
  });

  test('a new clone is private until its owner shares it', async ({ page }) => {
    await openOwnedTrip(page);

    // Nobody should publish a trip by accident.
    await expect(page.getByRole('radio', { name: /Private/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /Public/ })).not.toBeChecked();
  });
});
