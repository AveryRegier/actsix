import { test } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

test.describe('login screenshots', () => {
  test('capture login email form', async ({ page, request }) => {
    await seedDemoData(request);
    await page.goto('/email-login.html');

    await highlightElement(page, page.getByLabel(/email address/i), 'blue');
    await highlightElement(page, page.getByRole('button', { name: /send validation code/i }), 'orange');
    await takeHelpScreenshot(page, 'login-email-form.png');
  });

  test('capture login code email example', async ({ page, request }) => {
    await seedDemoData(request);
    // Navigate to login page with mock email submitted state
    await page.goto('/email-login.html');
    await page.getByLabel(/email address/i).fill(DEMO.deaconEmail);
    await page.getByRole('button', { name: /send validation code/i }).click();
    // Wait for validation form to appear
    await page.waitForSelector('#validationForm', { state: 'visible', timeout: 5000 }).catch(() => {});
    // Render a fake "email preview" section via evaluate
    await page.evaluate(() => {
      const container = document.querySelector('.container');
      if (!container) return;
      const preview = document.createElement('div');
      preview.style.cssText = 'background:#f8f9fa;border:1px solid #ddd;border-radius:8px;padding:20px;margin:16px 0;font-family:monospace;font-size:0.9em;color:#333;';
      preview.innerHTML = `
        <div style="color:#888;margin-bottom:8px;">From: ActSix Deacon Care System &lt;noreply@example.com&gt;</div>
        <div style="color:#888;margin-bottom:16px;">Subject: Your login code</div>
        <p>Your validation code is:</p>
        <div style="font-size:2em;font-weight:bold;letter-spacing:0.2em;color:#667eea;margin:12px 0;">482917</div>
        <p style="color:#888;font-size:0.85em;">This code expires in 15 minutes.</p>
      `;
      container.insertBefore(preview, container.firstChild);
    });
    await takeHelpScreenshot(page, 'login-code-email.png');
  });

  test('capture login code entry form', async ({ page, request }) => {
    await seedDemoData(request);
    await page.goto('/email-login.html');
    await page.getByLabel(/email address/i).fill(DEMO.deaconEmail);
    await page.getByRole('button', { name: /send validation code/i }).click();
    await page.waitForSelector('#validationForm', { state: 'visible', timeout: 5000 }).catch(() => {});

    await highlightElement(page, page.getByLabel(/validation code/i), 'blue');
    await highlightElement(page, page.getByRole('button', { name: /validate code/i }), 'orange');
    await takeHelpScreenshot(page, 'login-code-form.png');
  });
});
