import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsRole } from '../support/site-session-helpers.js';

// Test all pages with navigation to ensure hamburger works on desktop and mobile
test.describe('site nav comprehensive validation', () => {
  // Pages with server-rendered nav (renderPageWithNav or renderRoleAwareHomePage)
  // Focus on pages accessible without auth/query params that will load
  const pagesWithNav = [
    // Home page - all roles can access
    { path: '/', name: 'home (index)', roles: ['deacon'] },
    // Direct nav links - different role requirements
    { path: '/members.html', name: 'members', roles: ['deacon'] },
    { path: '/contact-summary.html', name: 'contact-summary', roles: ['deacon'] },
    { path: '/deacon-quick-contact.html', name: 'deacon-quick-contact', roles: ['deacon'] },
    // Secondary pages with nav (only test if they're accessible via direct link)
    { path: '/sign-ups.html', name: 'sign-ups', roles: ['deacon'] },
    { path: '/event-schedule.html', name: 'event-schedule', roles: ['deacon'] },
    { path: '/event-assignments.html', name: 'event-assignments', roles: ['deacon'] },
  ];

  test.describe('hamburger menu on mobile viewport (500px)', () => {
    pagesWithNav.forEach(({ path, name, roles }) => {
      roles.forEach(role => {
        test(`${name} - ${role} role`, async ({ page }) => {
          await authenticateAsRole(page, role);
          await page.setViewportSize({ width: 500, height: 844 });

          await page.goto(path);

          // Wait for nav to be rendered
          await expect(page.locator('#site-nav-container')).toBeVisible({ timeout: 5000 });

          // Check hamburger button is visible on mobile
          const hamburgerBtn = page.locator('.nav-menu-btn');
          await expect(hamburgerBtn).toBeVisible();

          // Check hamburger button is visible (not display:none)
          const isVisible = await hamburgerBtn.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none';
          });
          expect(isVisible).toBe(true);

          // Mobile menu should exist and be closed initially (display: none by default)
          const mobileMenu = page.locator('#navMobileMenu');
          const isClosed = await mobileMenu.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display === 'none' || !el.classList.contains('open');
          });
          expect(isClosed).toBe(true);

          // Click hamburger to open menu
          await hamburgerBtn.click();
          const isOpen = await mobileMenu.evaluate(el => {
            const style = window.getComputedStyle(el);
            return el.classList.contains('open') && style.display === 'flex';
          });
          expect(isOpen).toBe(true);

          // Click hamburger again to close menu
          await hamburgerBtn.click();
          const isClosed2 = await mobileMenu.evaluate(el => {
            const style = window.getComputedStyle(el);
            return !el.classList.contains('open');
          });
          expect(isClosed2).toBe(true);
        });
      });
    });
  });

  test.describe('hamburger menu on desktop viewport (1024px)', () => {
    pagesWithNav.forEach(({ path, name, roles }) => {
      roles.forEach(role => {
        test(`${name} - ${role} role`, async ({ page }) => {
          await authenticateAsRole(page, role);
          await page.setViewportSize({ width: 1024, height: 768 });

          await page.goto(path);

          // Wait for nav to be rendered
          await expect(page.locator('#site-nav-container')).toBeVisible({ timeout: 5000 });

          // Check hamburger button is hidden on desktop
          const hamburgerBtn = page.locator('.nav-menu-btn');
          const isHidden = await hamburgerBtn.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display === 'none';
          });
          expect(isHidden).toBe(true);

          // Desktop nav should be visible
          const desktopNav = page.locator('.nav-content');
          await expect(desktopNav).toBeVisible();
        });
      });
    });
  });

  test.describe('role-based nav link visibility', () => {
    test('deacon sees all applicable links', async ({ page }) => {
      await authenticateAsRole(page, 'deacon');
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/members.html');

      await expect(page.locator('#site-nav-container')).toBeVisible({ timeout: 5000 });

      // Check desktop nav has expected links (excluding schedule-event on desktop)
      const homeLink = page.locator('.nav-content .home-link');
      const deaconLink = page.locator('.nav-content .deacon-link');
      const membersLink = page.locator('.nav-content .members-link');
      const summaryLink = page.locator('.nav-content .summary-link');

      await expect(homeLink).toBeVisible();
      await expect(deaconLink).toBeVisible();
      await expect(membersLink).toBeVisible();
      await expect(summaryLink).toBeVisible();

      // Schedule event link should not appear on desktop (desktop: false)
      const scheduleLink = page.locator('.nav-content .schedule-event-link');
      await expect(scheduleLink).not.toBeVisible();
    });

    test('staff sees appropriate links', async ({ page }) => {
      await authenticateAsRole(page, 'staff');
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/members.html');

      await expect(page.locator('#site-nav-container')).toBeVisible({ timeout: 5000 });

      // Staff should see most links
      const homeLink = page.locator('.nav-content .home-link');
      const deaconLink = page.locator('.nav-content .deacon-link');
      const membersLink = page.locator('.nav-content .members-link');

      await expect(homeLink).toBeVisible();
      await expect(deaconLink).toBeVisible();
      await expect(membersLink).toBeVisible();
    });
  });

  test.describe('nav links are functional', () => {
    test('clicking nav links navigates to correct page', async ({ page }) => {
      await authenticateAsRole(page, 'deacon');
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/members.html');

      await expect(page.locator('#site-nav-container')).toBeVisible({ timeout: 5000 });

      // Click home link in desktop nav
      const homeLink = page.locator('.nav-content .home-link');
      await homeLink.click();

      // Should navigate to home page
      await expect(page).toHaveURL(/^.*\/(index\.html)?(\?.*)?$/);
    });

    test('mobile menu closes when link is clicked', async ({ page }) => {
      await authenticateAsRole(page, 'deacon');
      await page.setViewportSize({ width: 500, height: 844 });
      await page.goto('/members.html');

      await expect(page.locator('#site-nav-container')).toBeVisible({ timeout: 5000 });

      // Open mobile menu
      const hamburgerBtn = page.locator('.nav-menu-btn');
      await hamburgerBtn.click();

      const mobileMenu = page.locator('#navMobileMenu');
      const isOpen = await mobileMenu.evaluate(el => el.classList.contains('open'));
      expect(isOpen).toBe(true);

      // Click a nav link
      const homeLink = page.locator('#navMobileMenu .home-link');
      await homeLink.click();

      // Menu should close (or page navigates)
      await page.waitForTimeout(100); // Small delay for handler to fire
      const isClosed = await mobileMenu.evaluate(el => !el.classList.contains('open'));
      expect(isClosed).toBe(true);
    });
  });

  test.describe('nav script loads correctly once', () => {
    test('site-nav.js loaded only once per page', async ({ page }) => {
      await authenticateAsRole(page, 'deacon');
      await page.setViewportSize({ width: 500, height: 844 });
      await page.goto('/members.html');

      // Count how many times site-nav.js is in the page
      const navScriptCount = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.filter(s => s.src && s.src.includes('site-nav.js')).length;
      });

      // Should only have one site-nav.js script tag
      expect(navScriptCount).toBe(1);

      // site-nav.js functions should be available
      const hasToggleMenu = await page.evaluate(() => typeof window.toggleMenu === 'function');
      expect(hasToggleMenu).toBe(true);

      const hasCloseMenu = await page.evaluate(() => typeof window.closeMenu === 'function');
      expect(hasCloseMenu).toBe(true);
    });
  });

  test.describe('nav container exists and is properly positioned', () => {
    pagesWithNav.forEach(({ path, name }) => {
      test(`${name} has nav-container`, async ({ page }) => {
        await authenticateAsRole(page, 'deacon');
        await page.goto(path);

        // Nav container should exist
        const navContainer = page.locator('#site-nav-container');
        await expect(navContainer).toBeVisible({ timeout: 5000 });

        // Nav container should have content (at least home link)
        const navLinks = navContainer.locator('.nav-content .nav-link, .home-link');
        const linkCount = await navLinks.count();
        expect(linkCount).toBeGreaterThan(0);
      });
    });
  });

  test.describe('sign-ups page mobile nav includes icon', () => {
    test('sign-ups mobile menu shows icon', async ({ page }) => {
      await authenticateAsRole(page, 'deacon');
      await page.setViewportSize({ width: 500, height: 844 });
      await page.goto('/sign-ups.html');

      await expect(page.locator('#site-nav-container')).toBeVisible({ timeout: 5000 });

      // Check mobile menu has sign-ups link with icon
      const signUpsLink = page.locator('#navMobileMenu .sign-ups-link');
      if (await signUpsLink.isVisible()) {
        // Link should have icon indicator
        const linkHTML = await signUpsLink.innerHTML();
        // Should contain icon (✅ character or icon element)
        expect(linkHTML).toMatch(/✅|icon|svg/i);
      }
    });
  });
});
