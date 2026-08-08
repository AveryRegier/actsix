import { test, expect } from '../support/browser-coverage.js';

test.describe('role based summary (site-only)', () => {
  test('contact summary page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/contact-summary.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
