import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsRole } from '../support/site-session-helpers.js';

test.describe('site nav user flows', () => {
  test('menu button toggles the mobile nav menu', async ({ page }) => {
    await authenticateAsRole(page, 'deacon');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/members.html');

    const mobileMenu = page.locator('#navMobileMenu');
    const menuButton = page.locator('.nav-menu-btn');

    await expect(mobileMenu).not.toHaveClass(/open/);
    await menuButton.click();
    await expect(mobileMenu).toHaveClass(/open/);
    await menuButton.click();
    await expect(mobileMenu).not.toHaveClass(/open/);
  });

  test('goBack falls back to index page when no referrer exists', async ({ page }) => {
    await authenticateAsRole(page, 'deacon');

    await page.goto('/members.html');
    await page.evaluate(() => {
      if (typeof window.goBack === 'function') {
        window.goBack();
      }
    });

    await expect(page).toHaveURL(/(?:\/|index\.html)$/);
  });

  test('addNavLink appends custom links to desktop and mobile nav extras', async ({ page }) => {
    await authenticateAsRole(page, 'deacon');

    await page.goto('/members.html');
    await page.evaluate(() => {
      if (typeof window.addNavLink === 'function') {
        window.addNavLink('<a href="/custom-test-link.html" class="nav-link custom-nav-link">Custom Link</a>');
      }
    });

    await expect(page.locator('.site-nav .nav-extra .custom-nav-link')).toHaveCount(2);
  });
});