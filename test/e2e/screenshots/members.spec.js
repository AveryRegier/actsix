import { test, expect } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

test.describe('members screenshots', () => {
  test('capture members list', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    await page.goto('/members.html');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('#memberTableBody tr');
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);
    await expect(page.locator('#memberTableBody')).toContainText(DEMO.deaconLastName);
    await expect(page.locator('#memberTableBody')).toContainText(DEMO.staffLastName);
    await expect(page.locator('#memberTableBody')).toContainText(DEMO.helperLastName);
    await expect(page.locator('#memberTableBody')).toContainText(DEMO.memberLastName);

    await takeHelpScreenshot(page, 'members-list.png');
  });

  test('capture tag filter dropdown', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    await page.goto('/members.html');
    await page.waitForLoadState('networkidle');

    const filterEl = page.locator('#tagFilter, select[id*="tag"], select[id*="filter"]').first();
    await expect(filterEl).toBeVisible();
    await highlightElement(page, filterEl, 'blue');
    await takeHelpScreenshot(page, 'members-filter-tags.png');
  });

  test('capture add new member button', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    await page.goto('/members.html');
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('link', { name: /add new member/i })
      .or(page.getByRole('button', { name: /add new member/i }));
    await expect(addBtn.first()).toBeVisible();
    await highlightElement(page, addBtn.first(), 'orange');
    await takeHelpScreenshot(page, 'members-add-button.png');
  });
});
