import { test, expect } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

function buildUniqueMembers() {
  return [
    { householdId: 'hh-1', firstName: 'Ruth', lastName: 'Evans', tags: ['helper'] },
    { householdId: 'hh-2', firstName: 'Mark', lastName: 'Smith', tags: ['deacon'] },
    { householdId: 'hh-3', firstName: 'Grace', lastName: 'Williams', tags: ['staff'] },
    { householdId: 'hh-4', firstName: 'Beth', lastName: 'Johnson', tags: ['member', 'shut-in'] },
  ];
}

test.describe('members screenshots', () => {
  test('capture members list', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    const mockMembers = buildUniqueMembers();
    await page.route('**/api/members', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ members: mockMembers, count: mockMembers.length }),
      });
    });

    await page.goto('/members.html');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('#memberTableBody tr');
    await expect(rows).toHaveCount(4);
    const fullNames = (await rows.allTextContents())
      .map(text => text.replace(/\s+/g, ' ').trim())
      .map(text => text.split(' ').slice(0, 2).join(' '));
    expect(new Set(fullNames).size).toBe(fullNames.length);

    await takeHelpScreenshot(page, 'members-list.png');
  });

  test('capture tag filter dropdown', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    const mockMembers = buildUniqueMembers();
    await page.route('**/api/members', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ members: mockMembers, count: mockMembers.length }),
      });
    });

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

    const mockMembers = buildUniqueMembers();
    await page.route('**/api/members', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ members: mockMembers, count: mockMembers.length }),
      });
    });

    await page.goto('/members.html');
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('link', { name: /add new member/i })
      .or(page.getByRole('button', { name: /add new member/i }));
    await expect(addBtn.first()).toBeVisible();
    await highlightElement(page, addBtn.first(), 'orange');
    await takeHelpScreenshot(page, 'members-add-button.png');
  });
});
