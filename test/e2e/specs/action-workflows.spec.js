import { test, expect } from '../support/browser-coverage.js';

test.describe('action workflows (site-only)', () => {
  test('protected pages redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/household.html');
    await expect(page).toHaveURL(/email-login\.html/);

    await page.goto('/record-contact.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
