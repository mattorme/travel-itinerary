import { expect, test } from '@playwright/test';
import { openOwnedTrip } from './support/trip';

/**
 * Swapping and adding.
 *
 * Before this, a trip could only be made shorter: you could delete a stop you
 * disliked but never replace it. That made every generator mistake permanent,
 * which is the fastest way to lose trust in an itinerary.
 */

test.describe('swapping a stop', () => {
  test('offers alternatives and replaces the stop with the chosen one', async ({ page }) => {
    await openOwnedTrip(page);

    const day = page.locator('#day-1');
    const before = await day.locator('article h3').allInnerTexts();

    await day.getByRole('button', { name: 'Swap' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Swap this stop' });
    await expect(dialog).toBeVisible();

    // Distance from the rest of the day is the signal that decides whether a
    // swap keeps the day coherent, so it has to be on screen.
    await expect(dialog.getByText(/from the rest of the day/).first()).toBeVisible({
      timeout: 15_000,
    });

    const choice = await dialog.locator('button').filter({ hasText: /from the rest of the day/ }).first().locator('span').first().innerText();
    await dialog.locator('button').filter({ hasText: /from the rest of the day/ }).first().click();

    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(async () => {
      const after = await day.locator('article h3').allInnerTexts();
      expect(after).toContain(choice);
      expect(after).not.toEqual(before);
    }).toPass({ timeout: 20_000 });
  });

  test('never offers a place already used elsewhere in the trip', async ({ page }) => {
    await openOwnedTrip(page);

    const used = await page.locator('article h3').allInnerTexts();
    await page.locator('#day-1').getByRole('button', { name: 'Swap' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Swap this stop' });
    await expect(dialog.getByText(/from the rest of the day/).first()).toBeVisible({ timeout: 15_000 });

    const offered = await dialog.locator('button').filter({ hasText: /from the rest of the day/ }).allInnerTexts();
    for (const title of used) {
      expect(offered.join(' ')).not.toContain(title);
    }
  });

  test('a stop with no place has nothing to swap', async ({ page }) => {
    // The seeded trip has real places; a free-text stop added by hand does not.
    await openOwnedTrip(page);
    const day = page.locator('#day-2');
    await day.getByRole('button', { name: 'Add a stop' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add a stop' });
    await dialog.getByLabel('Search places').fill('Picnic by the river');
    await dialog.getByRole('button', { name: /as my own stop/ }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    await expect(day.getByRole('heading', { name: 'Picnic by the river' })).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe('adding a stop', () => {
  test('searches the destination and adds the chosen place', async ({ page }) => {
    await openOwnedTrip(page);

    const day = page.locator('#day-3');
    const before = (await day.locator('article h3').allInnerTexts()).length;

    await day.getByRole('button', { name: 'Add a stop' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a stop' });
    await expect(dialog.getByText('Start typing to find somewhere.')).toBeVisible();

    await dialog.getByLabel('Search places').fill('Nezu');
    await expect(dialog.getByRole('heading', { level: 2, name: 'Add a stop' })).toBeVisible();

    const first = dialog.locator('ul button').first();
    await expect(first).toBeVisible({ timeout: 15_000 });
    await first.click();

    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(async () => {
      const after = (await day.locator('article h3').allInnerTexts()).length;
      expect(after).toBe(before + 1);
    }).toPass({ timeout: 20_000 });
  });
});
