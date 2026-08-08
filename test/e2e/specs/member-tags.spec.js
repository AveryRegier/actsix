import { test, expect } from '../support/browser-coverage.js';

test.describe('member tags (site-only)', () => {
  test('members page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/members.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
