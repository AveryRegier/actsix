import { test, expect } from '../support/browser-coverage.js';

test.describe('contact workflow depth (site-only)', () => {
  test('record contact page is protected when unauthenticated', async ({ page }) => {
    await page.goto('/record-contact.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
