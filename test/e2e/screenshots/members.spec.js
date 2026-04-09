import { test } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

test.describe('members screenshots', () => {
  test('capture members list', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto('/members.html');
    await page.waitForLoadState('networkidle');
    await takeHelpScreenshot(page, 'members-list.png');
  });

  test('capture tag filter dropdown', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto('/members.html');
    await page.waitForLoadState('networkidle');

    const filterEl = page.locator('select[id*="tag"], select[id*="filter"], #tagFilter').first();
    if (await filterEl.count() > 0) {
      await highlightElement(page, filterEl, 'blue');
    }
    await takeHelpScreenshot(page, 'members-filter-tags.png');
  });

  test('capture add new member button', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto('/members.html');
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('link', { name: /add new member/i })
      .or(page.getByRole('button', { name: /add new member/i }));
    if (await addBtn.count() > 0) {
      await highlightElement(page, addBtn.first(), 'orange');
    }
    await takeHelpScreenshot(page, 'members-add-button.png');
  });
});
