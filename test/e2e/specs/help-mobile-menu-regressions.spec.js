import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsRole } from '../support/site-session-helpers.js';

test.describe('help/mobile menu regressions', () => {
  test('home page hamburger menu opens and closes on mobile', async ({ page }) => {
    await authenticateAsRole(page, 'deacon');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const mobileMenu = page.locator('#navMobileMenu');
    const menuButton = page.locator('.nav-menu-btn');

    await expect(menuButton).toBeVisible();
    await expect(mobileMenu).not.toHaveClass(/open/);

    await menuButton.click();
    await expect(mobileMenu).toHaveClass(/open/);

    await menuButton.click();
    await expect(mobileMenu).not.toHaveClass(/open/);
  });

  test('browser back from help closes menu and menu can re-open on home page', async ({ page }) => {
    await authenticateAsRole(page, 'deacon');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const menuButton = page.locator('.nav-menu-btn');
    const mobileMenu = page.locator('#navMobileMenu');

    // Open hamburger menu on home page and navigate to page help from mobile menu.
    await menuButton.click();
    await expect(mobileMenu).toHaveClass(/open/);

    await page.locator('#siteNavHelpLinkMenu').click();
    await expect(page).toHaveURL(/\/help\.html\?page=index$/);

    // Re-open hamburger on help page then simulate browser back gesture/button.
    const helpMenuButton = page.locator('.nav-menu-btn');
    const helpMobileMenu = page.locator('#navMobileMenu');
    await helpMenuButton.click();
    await expect(helpMobileMenu).toHaveClass(/open/);

    await page.goBack();
    await expect(page).toHaveURL(/(?:\/|index\.html)$/);

    // After back, menu must be closed and must still open when requested.
    const returnedMenu = page.locator('#navMobileMenu');
    const returnedMenuButton = page.locator('.nav-menu-btn');
    await expect(returnedMenu).not.toHaveClass(/open/);

    await returnedMenuButton.click();
    await expect(returnedMenu).toHaveClass(/open/);
  });
});
