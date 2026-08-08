import { test, expect } from '../support/browser-coverage.js';

test.describe('common locations (site-only)', () => {
  test('edit member page is protected when unauthenticated', async ({ page }) => {
    await page.goto('/edit-member.html?id=demo');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
