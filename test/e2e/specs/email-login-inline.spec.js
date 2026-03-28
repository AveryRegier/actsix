import { test, expect } from '../support/browser-coverage.js';
import { apiPost } from '../support/workflow-helpers.js';
import { findLatestCodeForEmail, resetMailbox } from '../../harness/fake-mailbox.js';

const API_KEY = 'test-generation-key';

async function createMemberWithEmail(request, email) {
  const stamp = Date.now();
  const hhRes = await apiPost(request, '/api/households', { lastName: `LoginInlineHH-${stamp}` });
  expect(hhRes.ok()).toBeTruthy();
  const hh = await hhRes.json();

  const memberRes = await apiPost(request, '/api/members', {
    householdId: hh.id,
    firstName: 'LoginInline',
    lastName: `User${stamp}`,
    relationship: 'head',
    gender: 'male',
    email,
    tags: ['member'],
  });
  expect(memberRes.ok()).toBeTruthy();
}

async function waitForCode(email, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const code = findLatestCodeForEmail(email);
    if (code) return code;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

// Reach the validation form step by intercepting the /email-request-code route
// so the test never depends on real mail delivery for state-transition tests.
// Uses page.once so only the one success-alert dialog is consumed here and the
// caller's own listener can handle any subsequent dialogs independently.
async function reachValidationForm(page, email) {
  const dialogs = [];
  let requestBody = null;
  page.once('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await page.route('**/email-request-code', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/email-login.html');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole('button', { name: /send validation code/i }).click();

  // Wait for the validation form to become visible (the alert fires first)
  await expect(page.locator('#validationForm')).toBeVisible({ timeout: 5000 });

  return { dialogs, requestBody };
}

test.describe('email-login inline behavior', () => {
  test('email-login page loads the site-nav bar', async ({ page }) => {
    await page.goto('/email-login.html');
    await expect(page.locator('#site-nav-container .site-nav')).toBeVisible();

    const scriptsBefore = await page.locator('script[src="site-nav.js"]').count();
    expect(scriptsBefore).toBe(1);

    await page.evaluate(() => {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    });
    await page.waitForTimeout(100);

    const scriptsAfter = await page.locator('script[src="site-nav.js"]').count();
    expect(scriptsAfter).toBe(1);
  });

  test('deduplicates duplicate email login forms on load', async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('emailLoginForm');
        if (!form) return;
        const duplicate = form.cloneNode(true);
        form.parentElement.appendChild(duplicate);
      });
    });

    await page.goto('/email-login.html');
    await expect(page.locator('#emailLoginForm')).toHaveCount(1);
  });

  test('submitting blank email shows alert', async ({ page }) => {
    let alertMessage = '';
    page.on('dialog', async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await page.goto('/email-login.html');
    await page.getByRole('button', { name: /send validation code/i }).click();

    // Give dialog time to fire then check
    await page.waitForTimeout(300);
    expect(alertMessage).toMatch(/please enter your email address/i);
  });

  test('successful email submit hides email form and shows validation form', async ({ page }) => {
    const { dialogs, requestBody } = await reachValidationForm(page, ' inline-test@example.test ');
    // The success alert fires before the form transitions
    expect(dialogs.some((m) => /login link sent/i.test(m))).toBeTruthy();
    expect(requestBody).toEqual({ email: 'inline-test@example.test' });

    await expect(page.locator('#emailLoginForm')).toBeHidden();
    await expect(page.locator('#validationForm')).toBeVisible();
    // Validation email hidden input should carry the email
    const hiddenEmail = await page.locator('#validationEmail').inputValue();
    expect(hiddenEmail).toBe('inline-test@example.test');
    await expect(page.locator('#code')).toBeFocused();
    await expect(page.locator('#code')).toHaveValue('');
  });

  test('change email button restores email form with email pre-filled', async ({ page }) => {
    const email = 'change-email@example.test';
    await reachValidationForm(page, email);

    await page.getByRole('button', { name: /change email/i }).click();

    await expect(page.locator('#emailLoginForm')).toBeVisible();
    await expect(page.locator('#validationForm')).toBeHidden();
    const emailFieldValue = await page.locator('#emailLoginForm [name="email"]').inputValue();
    expect(emailFieldValue).toBe(email);
    await expect(page.locator('#email')).toBeFocused();
  });

  test('submitting blank code shows alert', async ({ page }) => {
    await reachValidationForm(page, 'blank-code@example.test');

    let codeAlertMessage = '';
    page.on('dialog', async (dialog) => {
      codeAlertMessage = dialog.message();
      await dialog.accept();
    });

    await page.getByRole('button', { name: /validate code/i }).click();
    await page.waitForTimeout(300);
    expect(codeAlertMessage).toMatch(/please enter the validation code/i);
    await expect(page).toHaveURL(/\/email-login\.html$/);
  });

  test('API error on email-request-code shows error alert', async ({ page }) => {
    let alertMessage = '';
    page.on('dialog', async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await page.route('**/email-request-code', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server error"}' });
    });

    await page.goto('/email-login.html');
    await page.getByLabel(/email address/i).fill('error-test@example.test');
    await page.getByRole('button', { name: /send validation code/i }).click();

    await page.waitForTimeout(500);
    expect(alertMessage).toMatch(/error sending login validation code/i);
    // Email form must remain visible — user should be able to correct their email
    await expect(page.locator('#emailLoginForm')).toBeVisible();
  });

  test('API error on email-validate shows invalid code alert', async ({ page }) => {
    await reachValidationForm(page, 'validate-error@example.test');

    let alertMessage = '';
    page.on('dialog', async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await page.route('**/email-validate', async (route) => {
      await route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid"}' });
    });

    await page.locator('#code').fill('000000');
    await page.getByRole('button', { name: /validate code/i }).click();

    await page.waitForTimeout(500);
    expect(alertMessage).toMatch(/invalid code/i);
    await expect(page).toHaveURL(/\/email-login\.html$/);
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(token).toBeNull();
  });

  test('full login flow via fake mailbox sets localStorage token', async ({ page, request }) => {
    resetMailbox();

    const stamp = Date.now();
    const email = `login-inline-full-${stamp}@example.test`;
    await createMemberWithEmail(request, email);

    page.on('dialog', async (dialog) => await dialog.accept());

    await page.goto('/email-login.html');
    await page.getByLabel(/email address/i).fill(email);
    await page.getByRole('button', { name: /send validation code/i }).click();

    const code = await waitForCode(email);
    expect(code).toBeTruthy();

    await page.getByLabel(/validation code/i).fill(code);
    await page.getByRole('button', { name: /validate code/i }).click();

    await expect(page).toHaveURL(/\/$/);
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(token).toBeTruthy();
    const memberId = await page.evaluate(() => localStorage.getItem('memberId'));
    expect(memberId).toBeTruthy();
    const cookie = await page.evaluate(() => document.cookie);
    expect(cookie).toContain('actsix=');
  });
});
