import { test, expect } from '../support/browser-coverage.js';

test.describe('household page (site-only)', () => {
  test('household page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/household.html?id=demo');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
