import { test } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

test.describe('record-contact screenshots', () => {
  test('capture record contact form fields', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/record-contact.html?householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    await highlightElement(page, page.locator('#contact-type'), 'blue');
    await highlightElement(page, page.locator('#summary'), 'blue');
    await takeHelpScreenshot(page, 'record-contact-form.png');
  });

  test('capture contacted-by section', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/record-contact.html?householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const deaconsSection = page.locator('#deaconsSection');
    if (await deaconsSection.count() > 0) {
      await highlightElement(page, deaconsSection, 'green');
    }
    await takeHelpScreenshot(page, 'record-contact-contacted-by.png');
  });
});
