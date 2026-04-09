import { test } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

test.describe('index screenshots', () => {
  test('capture home page cards', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await takeHelpScreenshot(page, 'index-home-cards.png');
  });

  test('capture nav bar', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await highlightElement(page, page.locator('.site-nav'), 'blue');
    await takeHelpScreenshot(page, 'index-nav-bar.png');
  });
});
