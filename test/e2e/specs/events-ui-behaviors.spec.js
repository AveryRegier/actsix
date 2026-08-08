import { test, expect } from '../support/browser-coverage.js';

test.describe('events ui behaviors (site-only)', () => {
  test('sign-ups page is protected when unauthenticated', async ({ page }) => {
    await page.goto('/sign-ups.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
