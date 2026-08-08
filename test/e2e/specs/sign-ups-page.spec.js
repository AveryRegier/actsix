import { test, expect } from '../support/browser-coverage.js';

test.describe('sign ups page (site-only)', () => {
  test('sign-ups page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/sign-ups.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
