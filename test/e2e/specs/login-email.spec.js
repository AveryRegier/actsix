import { test, expect } from '../support/browser-coverage.js';
import { findLatestCodeForEmail, resetMailbox } from '../../harness/fake-mailbox.js';

async function waitForCode(email, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const code = findLatestCodeForEmail(email);
    if (code) {
      return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

test('email login flow uses fake mailbox validation code @smoke', async ({ page, request }) => {
  resetMailbox();

  const stamp = Date.now();
  const email = `phase3-user-${stamp}@example.test`;

  const householdRes = await request.post('/api/households', {
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'test-generation-key',
    },
    data: {
      lastName: `Household-${stamp}`,
    },
  });
  expect(householdRes.ok()).toBeTruthy();
  const household = await householdRes.json();

  const memberRes = await request.post('/api/members', {
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'test-generation-key',
    },
    data: {
      householdId: household.id,
      firstName: 'Phase3',
      lastName: 'User',
      relationship: 'head',
      gender: 'male',
      email,
      tags: ['member'],
    },
  });
  expect(memberRes.ok()).toBeTruthy();

  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

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
});
