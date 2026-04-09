import { test } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

test.describe('edit-member screenshots', () => {
  test('capture edit member basic info', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/edit-member.html?memberId=${ids.memberId}&householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');
    await takeHelpScreenshot(page, 'edit-member-info.png');
  });

  test('capture member tags section', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/edit-member.html?memberId=${ids.memberId}&householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const tags = page.locator('.tag-badge').first();
    if (await tags.count() > 0) {
      await highlightElement(page, tags, 'green');
    }
    await takeHelpScreenshot(page, 'edit-member-tags.png');
  });

  test('capture temporary address section', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/edit-member.html?memberId=${ids.memberId}&householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const tempLocation = page.locator('#temporaryLocation, #location, input[name*="location"]').first();
    if (await tempLocation.count() > 0) {
      await highlightElement(page, tempLocation, 'blue');
    }
    await takeHelpScreenshot(page, 'edit-member-temp-address.png');
  });
});
