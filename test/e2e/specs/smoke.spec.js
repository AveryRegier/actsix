import { test, expect } from '../support/browser-coverage.js';

test('loads login page @smoke', async ({ page }) => {
  await page.goto('/email-login.html');

  await expect(page).toHaveTitle(/ActSix|Deacon|Login/i);
  await expect(page.getByLabel(/email/i)).toBeVisible();
});

test('redirects protected page to login @smoke', async ({ page }) => {
  await page.goto('/members.html');
  await expect(page).toHaveURL(/email-login\.html/);
});
