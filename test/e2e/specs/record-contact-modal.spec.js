import { test, expect } from '../support/browser-coverage.js';

test.describe('record contact modal (site-only)', () => {
  test('record-contact page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/record-contact.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
