import { expect, type Page } from '@playwright/test';

export const DEMO_SLUG = 'three-slow-days-in-tokyo';
export const DEMO_TRIP = `/t/${DEMO_SLUG}`;

/**
 * Clone the demo trip and return the clone's public URL.
 *
 * The wait is deliberately "a /t/ URL that is not the one we started on".
 * Waiting on `/\/t\/[a-z0-9-]+/` alone matches the page already open, so it can
 * resolve before the navigation happens and every later assertion then runs
 * against the original trip — which looks like a product bug and is not.
 */
export async function cloneDemoTrip(page: Page): Promise<string> {
  await page.goto(DEMO_TRIP);
  await page.getByRole('button', { name: 'Make this trip yours' }).click();

  await page.waitForURL(
    (url) => url.pathname.startsWith('/t/') && url.pathname !== DEMO_TRIP,
    { timeout: 20_000 },
  );

  // A clone is owned by the caller, so this button is proof we are on the copy.
  await expect(page.getByRole('button', { name: 'Edit this trip' })).toBeVisible({
    timeout: 20_000,
  });

  return page.url();
}

/** Clone the demo trip and open the owner's editable view of it. */
export async function openOwnedTrip(page: Page): Promise<{ publicUrl: string }> {
  const publicUrl = await cloneDemoTrip(page);
  await page.getByRole('button', { name: 'Edit this trip' }).click();
  await page.waitForURL(/\/trips\/[0-9a-f-]+/, { timeout: 20_000 });
  return { publicUrl };
}
