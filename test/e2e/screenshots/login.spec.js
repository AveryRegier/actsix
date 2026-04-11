import { test, expect } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, waitForCode, DEMO
} from './capture-helpers.js';

test.describe('login screenshots', () => {
  test('capture login email form', async ({ page, request }) => {
    await seedDemoData(request);
    await page.goto('/email-login.html');

    const emailField = page.getByLabel(/email address/i);
    const sendCodeButton = page.getByRole('button', { name: /send validation code/i });
    await expect(emailField).toBeVisible();
    await expect(sendCodeButton).toBeVisible();
    await highlightElement(page, emailField, 'blue');
    await highlightElement(page, sendCodeButton, 'orange');
    await takeHelpScreenshot(page, 'login-email-form.png');
  });

  test('capture login code entry form', async ({ page, request }) => {
    await seedDemoData(request);
    await page.goto('/email-login.html');
    await page.getByLabel(/email address/i).fill(DEMO.deaconEmail);
    await page.getByRole('button', { name: /send validation code/i }).click();
    await page.waitForSelector('#validationForm', { state: 'visible', timeout: 5000 }).catch(() => {});

    const validationCodeField = page.getByLabel(/validation code/i);
    const validateButton = page.getByRole('button', { name: /validate code/i });
    await expect(validationCodeField).toBeVisible();
    await expect(validateButton).toBeVisible();
    const code = await waitForCode(DEMO.deaconEmail);
    await validationCodeField.fill(code);
    await highlightElement(page, validationCodeField, 'blue');
    await highlightElement(page, validateButton, 'orange');
    await takeHelpScreenshot(page, 'login-code-form.png');
  });
});
