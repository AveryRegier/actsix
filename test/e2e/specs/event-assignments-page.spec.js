import { test, expect } from '../support/browser-coverage.js';

test.describe('event assignments page (site-only)', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/event-assignments.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
