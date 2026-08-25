import { expect, test } from '@playwright/test';

const DEMO = '/t/three-slow-days-in-tokyo';

/**
 * What happens when the tab is closed and you are standing in the street.
 */
test.describe('taking a trip with you', () => {
  test('the calendar export is a real .ics download', async ({ page, request }) => {
    await page.goto(DEMO);
    await expect(page.getByRole('link', { name: 'Add to calendar' })).toBeVisible();

    const response = await request.get(`${DEMO}/calendar`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');
    expect(response.headers()['content-disposition']).toContain('.ics');

    const body = await response.text();
    expect(body.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(body).toContain('BEGIN:VEVENT');
    // Floating local time — a Z here would shift the whole trip by hours.
    expect(body).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
  });

  test('a private trip cannot be exported by a stranger', async ({ request }) => {
    // The export goes through the same RLS-bound loader as the page, so this is
    // a 404 for the same reason the page is.
    const response = await request.get('/t/definitely-not-a-real-trip/calendar');
    expect(response.status()).toBe(404);
  });

  test('printing hides the chrome and keeps the itinerary', async ({ page }) => {
    await page.goto(DEMO);
    await page.emulateMedia({ media: 'print' });

    // Site chrome goes.
    await expect(page.locator('[data-print-hide]').first()).toBeHidden();
    await expect(page.getByRole('link', { name: 'Explore' })).toBeHidden();

    // Everything a printed itinerary is for stays — this is the part a blanket
    // `header { display: none }` silently destroyed.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The old east side' })).toBeVisible();
    // Scoped to the day section: the first /Day 1/ on the page is the sticky
    // day-nav chip, which is chrome and correctly hidden.
    await expect(page.locator('#day-1').getByText(/^Day 1/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Yanaka Cemetery walk' })).toBeVisible();
    await expect(page.getByText('9:30am')).toBeVisible();

    await page.emulateMedia({ media: 'screen' });
  });

  test('offline saving is app-only', async ({ page }) => {
    // In a browser the button is absent by design: the browser already has a
    // cache and a back button, and a half-working offline mode would be worse
    // than none.
    await page.goto(DEMO);
    await expect(page.getByRole('button', { name: /Save offline/ })).toHaveCount(0);
  });
});
