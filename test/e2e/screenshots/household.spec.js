import { test } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

test.describe('household screenshots', () => {
  test('capture household view', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/household.html?id=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');
    await takeHelpScreenshot(page, 'household-view.png');
  });

  test('capture edit household button', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/household.html?id=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const editBtn = page.locator('#editHouseholdBtn').or(page.getByRole('link', { name: /edit/i }).first());
    if (await editBtn.count() > 0) {
      await highlightElement(page, editBtn.first(), 'orange');
    }
    await takeHelpScreenshot(page, 'household-edit-button.png');
  });

  test('capture edit household form', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/edit-household.html?householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');
    await takeHelpScreenshot(page, 'household-edit-form.png');
  });

  test('capture add member button', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/household.html?id=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('#addMemberBtn').or(page.getByRole('link', { name: /add member/i }).first());
    if (await addBtn.count() > 0) {
      await highlightElement(page, addBtn.first(), 'orange');
    }
    await takeHelpScreenshot(page, 'household-add-member-button.png');
  });

  test('capture assign deacon button', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/household.html?id=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const assignBtn = page.locator('#assignDeaconBtn').or(page.getByRole('link', { name: /assign/i }).first());
    if (await assignBtn.count() > 0) {
      await highlightElement(page, assignBtn.first(), 'orange');
    }
    await takeHelpScreenshot(page, 'household-assign-button.png');
  });

  test('capture contact history section', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/household.html?id=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');
    await takeHelpScreenshot(page, 'household-contact-history.png');
  });

  test('capture record contact button', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/household.html?id=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const recordBtn = page.getByRole('link', { name: /record contact/i })
      .or(page.getByRole('button', { name: /record contact/i })).first();
    if (await recordBtn.count() > 0) {
      await highlightElement(page, recordBtn, 'orange');
    }
    await takeHelpScreenshot(page, 'record-contact-button.png');
  });
});
