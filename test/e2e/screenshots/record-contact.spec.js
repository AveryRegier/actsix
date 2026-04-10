import { test, expect } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

test.describe('record-contact screenshots', () => {
  test('capture record contact form fields', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/record-contact.html?householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const contactType = page.locator('#contact-type');
    const summary = page.locator('#summary');
    await expect(contactType).toBeVisible();
    await expect(summary).toBeVisible();
    await highlightElement(page, contactType, 'blue');
    await highlightElement(page, summary, 'blue');
    await takeHelpScreenshot(page, 'record-contact-form.png');
  });

  test('capture contacted-by section', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/record-contact.html?householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const deaconsSection = page.locator('#deaconsSection');
    await expect(deaconsSection).toBeVisible();
    await highlightElement(page, deaconsSection, 'green');
    await takeHelpScreenshot(page, 'record-contact-contacted-by.png');
  });
});
