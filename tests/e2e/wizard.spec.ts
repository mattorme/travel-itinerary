import { expect, test } from '@playwright/test';

/**
 * The wizard, end to end, without spending money.
 *
 * Stops short of submitting: generation costs real API calls, so the paid path
 * is covered by the fixture-backed integration suite instead. What matters here
 * is that a traveller can get through the form on a phone.
 */
test.describe('trip wizard', () => {
  test('a visitor can complete every step without an account', async ({ page }) => {
    await page.goto('/');
    // Deliberately not asserting the headline copy: this is a flow test, and
    // pinning it to marketing wording breaks the flow every time the pitch changes.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Plan my trip' }).click();
    await expect(page.getByRole('heading', { name: 'Where are you going?' })).toBeVisible();

    // The primary action must be reachable without scrolling, on a phone.
    const advance = page.getByRole('button', { name: /Continue|Build my itinerary/ });
    await expect(advance).toBeInViewport();

    await expect(advance).toBeDisabled();
    await page.getByPlaceholder(/Tokyo, Portugal/).fill('Tokyo');
    await expect(advance).toBeEnabled();

    await advance.click();
    await expect(page.getByRole('heading', { name: /When, and for how long/ })).toBeVisible();

    // The pills wrap a visually-hidden input, so the label is the hit target —
    // which is also what a real user (and a screen reader) interacts with.
    await page.locator('label').filter({ hasText: /^7 days$/ }).click();
    await advance.click();
    await expect(page.getByRole('heading', { name: /Who's going/ })).toBeVisible();

    await advance.click();
    await expect(page.getByRole('heading', { name: /What's your budget/ })).toBeVisible();

    await page.getByLabel('Total budget').fill('2500');
    await advance.click();
    await expect(page.getByRole('heading', { name: /How do you like to travel/ })).toBeVisible();

    // Rendered lowercase in the DOM and capitalised in CSS, so the accessible
    // name is lowercase.
    await page.getByRole('button', { name: /^relaxed/i }).click();
    await advance.click();
    await expect(page.getByRole('heading', { name: /What are you into/ })).toBeVisible();

    // Interests are the one genuinely required choice.
    await expect(advance).toBeDisabled();
    await page.locator('label').filter({ hasText: /^food$/ }).click();
    await page.locator('label').filter({ hasText: /^history$/ }).click();
    await expect(advance).toBeEnabled();

    await advance.click();
    await expect(page.getByRole('heading', { name: /Anything else/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Build my itinerary' })).toBeEnabled();
  });

  test('going back preserves what was already entered', async ({ page }) => {
    await page.goto('/plan');
    await page.getByPlaceholder(/Tokyo, Portugal/).fill('Lisbon');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page.getByPlaceholder(/Tokyo, Portugal/)).toHaveValue('Lisbon');
  });

  test('a landing-page suggestion prefills the destination', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /5 days in Tokyo/ }).click();
    await expect(page.getByPlaceholder(/Tokyo, Portugal/)).toHaveValue(/5 days in Tokyo/);
  });

  test('the landing-page form carries a typed sentence into the wizard', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/Where are you going/).fill('Six days in Seville, mostly eating');
    await page.getByRole('button', { name: 'Plan it' }).click();
    await expect(page.getByPlaceholder(/Tokyo, Portugal/)).toHaveValue(
      'Six days in Seville, mostly eating',
    );
  });

  /*
   * The form is a plain GET to /plan, and that is deliberate — it is the only
   * entry point on the page, so it has to work before any JavaScript has run.
   *
   * Submitted with the keyboard rather than the button: it is how the field is
   * actually used, and it covers the implicit-submission path that a click on
   * the button does not.
   */
  test('the landing-page form works with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByLabel(/Where are you going/).fill('Four days in Rome, no rushing');
    await page.getByLabel(/Where are you going/).press('Enter');
    await page.waitForURL(/\/plan\?q=Four\+days/);
    await context.close();
  });
});
