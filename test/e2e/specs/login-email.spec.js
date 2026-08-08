import { test, expect } from '../support/browser-coverage.js';

test.describe('login email page (site-only)', () => {
  test('loads login page and form controls', async ({ page }) => {
    await page.goto('/email-login.html');
    await expect(page.locator('#emailLoginForm')).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
  });
});
