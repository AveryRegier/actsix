import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsRole } from '../support/site-session-helpers.js';

test.describe('help content behavior', () => {
  test('login help renders markdown sections and images', async ({ page }) => {
    await page.goto('/help.html?page=login');

    await expect(page.locator('#help-content h2')).toHaveCount(1);
    await expect(page.locator('#help-content h2').first()).toContainText(/logging in/i);
    await expect(page.locator('#help-content')).toContainText(/validation code/i);
    await expect(page.locator('#help-content img')).toHaveCount(2);
  });

  test('deacon household help shows household details guidance', async ({ page }) => {
    await authenticateAsRole(page, 'deacon');

    await page.goto('/help.html?page=household');

    await expect(page.locator('#help-content')).toContainText(/Viewing Household Details/i);
    await expect(page.locator('#help-content')).toContainText(/Household Members/i);
    await expect(page.locator('#help-content')).toContainText(/Deacon Assignments/i);
  });

  test('staff household help shows household details guidance', async ({ page }) => {
    await authenticateAsRole(page, 'staff');

    await page.goto('/help.html?page=household');

    await expect(page.locator('#help-content')).toContainText(/Viewing Household Details/i);
    await expect(page.locator('#help-content')).toContainText(/Household Members/i);
    await expect(page.locator('#help-content')).toContainText(/Deacon Assignments/i);
  });

  test('helper household help shows household details guidance', async ({ page }) => {
    await authenticateAsRole(page, 'helper');

    await page.goto('/help.html?page=household');

    await expect(page.locator('#help-content')).toContainText(/Viewing Household Details/i);
    await expect(page.locator('#help-content')).toContainText(/Household Members/i);
    await expect(page.locator('#help-content')).toContainText(/Deacon Assignments/i);
  });

  test('members help shows configured content or explicit role-unavailable state', async ({ page }) => {
    await authenticateAsRole(page, 'deacon');

    await page.goto('/help.html?page=members');

    const helpText = await page.locator('#help-content').innerText();
    expect(
      /Viewing the Members List|No help is available for your role on this page\./i.test(helpText),
    ).toBeTruthy();
  });
});
