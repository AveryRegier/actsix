import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsRole } from '../support/site-session-helpers.js';

const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${Number(process.env.E2E_PORT || 3101)}`;

function appUrl(path) {
  return `${baseURL}${path}`;
}

test.describe('site uncovered feature coverage', () => {
  test.describe('mobile navigation behavior', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('mobile menu button toggles the menu open and closed', async ({ page }) => {
      await authenticateAsRole(page, 'deacon');

      await page.goto(appUrl('/members.html'));
      const menu = page.locator('#navMobileMenu');
      const menuButton = page.locator('.nav-menu-btn');

      await expect(menuButton).toBeVisible();
      await expect(menu).not.toHaveClass(/\bopen\b/);

      await menuButton.click();
      await expect(menu).toHaveClass(/\bopen\b/);

      await menuButton.click();
      await expect(menu).not.toHaveClass(/\bopen\b/);
    });

    test('current page links can be hidden for the active page', async ({ page }) => {
      await authenticateAsRole(page, 'deacon');

      await page.goto(appUrl('/members.html'));
      await expect(page.locator('.nav-content .members-link')).toHaveCount(1);
      await expect(page.locator('#navMobileMenu .members-link')).toHaveCount(1);

      await page.evaluate(() => {
        if (typeof window.hideCurrentPageNavLinks === 'function') {
          window.hideCurrentPageNavLinks();
        }
      });

      const displays = await page.evaluate(() => {
        const desktopLink = document.querySelector('.nav-content .members-link');
        const mobileLink = document.querySelector('#navMobileMenu .members-link');
        return {
          desktop: desktopLink ? getComputedStyle(desktopLink).display : '',
          mobile: mobileLink ? getComputedStyle(mobileLink).display : '',
        };
      });

      expect(displays.desktop).toBe('none');
      expect(displays.mobile).toBe('none');
    });

  });

  test.describe('print and redirect behavior', () => {
    test('contact summary print mode injects and removes print colgroup', async ({ page }) => {
      await authenticateAsRole(page, 'deacon');

      await page.goto(appUrl('/contact-summary.html'));
      await expect(page.locator('#summaryTable')).toBeVisible();

      await page.evaluate(() => {
        window.dispatchEvent(new Event('beforeprint'));
      });

      await expect(page.locator('#print-colgroup')).toBeVisible();
      await expect(page.locator('#print-colgroup col')).toHaveCount(7);

      await page.evaluate(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      await expect(page.locator('#print-colgroup')).toHaveCount(0);
    });

    test('print media hides nav chrome and shows print-only summary header', async ({ page }) => {
      await authenticateAsRole(page, 'deacon');

      await page.goto(appUrl('/contact-summary.html'));
      await expect(page.locator('#summaryTable')).toBeVisible();
      await expect(page.locator('#site-nav-container .site-nav')).toBeVisible();

      await page.emulateMedia({ media: 'print' });

      const printStyles = await page.evaluate(() => {
        const nav = document.querySelector('#site-nav-container .site-nav');
        const printOnlyHeader = document.querySelector('.summary-table .print-only');
        return {
          navDisplay: nav ? getComputedStyle(nav).display : '',
          printOnlyDisplay: printOnlyHeader ? getComputedStyle(printOnlyHeader).display : '',
        };
      });

      expect(printStyles.navDisplay).toBe('none');
      expect(printStyles.printOnlyDisplay).toBe('table-cell');
    });

    test('fetch redirect handler navigates browser after signout redirect response', async ({ page }) => {
      await authenticateAsRole(page, 'deacon');

      await page.goto(appUrl('/members.html'));

      await page.evaluate(async () => {
        await fetch('/signout', { method: 'GET', credentials: 'include' });
      });

      await expect(page).toHaveURL(/email-login\.html/);
    });
  });
});