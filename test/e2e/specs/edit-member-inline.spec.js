import { test, expect } from '../support/browser-coverage.js';

test.describe('edit member inline behavior (site-only)', () => {
  test('edit member page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/edit-member.html?id=demo');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
