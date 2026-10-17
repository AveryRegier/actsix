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

  test('signed-out visitors can only view login help pages', async ({ page }) => {
    for (const pageKey of ['help-index', 'index', 'sign-ups', 'household', 'edit-member']) {
      await page.goto(`/help.html?page=${pageKey}`);
      await expect(page.locator('#help-content')).toContainText(
        'No help is available for your role on this page.',
      );
    }
  });

  test('signed-out visitors cannot fetch non-login help content directly', async ({ page }) => {
    const loginGuide = await page.goto('/help/behaviors/login.md');
    expect(loginGuide.status()).toBe(200);

    const householdGuide = await page.goto('/help/behaviors/view-household.md');
    expect(householdGuide.status()).toBe(403);

    const loginScreenshot = await page.goto('/help/images/login-email-form.png');
    expect(loginScreenshot.status()).toBe(200);

    const householdScreenshot = await page.goto('/help/images/view-household.png');
    expect(householdScreenshot.status()).toBe(403);
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
