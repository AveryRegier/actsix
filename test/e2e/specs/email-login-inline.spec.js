import { test, expect } from '../support/browser-coverage.js';

test.describe('email login inline behavior (site-only)', () => {
  test('email-login page renders both forms shell', async ({ page }) => {
    await page.goto('/email-login.html');
    await expect(page.locator('#emailLoginForm')).toBeVisible();
    await expect(page.locator('#validationForm')).toBeHidden();
  });
});
