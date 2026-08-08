import { test, expect } from '../support/browser-coverage.js';

test.describe('temporary address flow (site-only)', () => {
  test('edit-member page with member id redirects unauthenticated users', async ({ page }) => {
    await page.goto('/edit-member.html?id=demo');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
