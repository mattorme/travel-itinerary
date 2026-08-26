import { expect, test } from '@playwright/test';
import { openOwnedTrip } from './support/trip';

/**
 * The privacy page tells people they can delete a trip, so there has to be a
 * way to — and it has to be honest about what a delete does not remove.
 */
test('an owner can delete their trip, and is told what survives', async ({ page }) => {
  const { publicUrl } = await openOwnedTrip(page);

  await page.getByRole('button', { name: 'Delete this trip' }).click();
  await expect(page.getByText('Delete this trip?')).toBeVisible();
  await expect(page.getByText(/shared link stops working/)).toBeVisible();

  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await page.waitForURL(/\/me$/, { timeout: 20_000 });

  // The shared link really does stop working.
  const response = await page.goto(publicUrl);
  expect(response?.status()).toBe(404);
});

test('deleting can be backed out of', async ({ page }) => {
  await openOwnedTrip(page);

  await page.getByRole('button', { name: 'Delete this trip' }).click();
  await page.getByRole('button', { name: 'Keep it' }).click();
  await expect(page.getByText('Delete this trip?')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
