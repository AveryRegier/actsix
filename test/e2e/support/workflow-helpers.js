import { expect } from '@playwright/test';
import { findLatestCodeForEmail, resetMailbox } from '../../harness/fake-mailbox.js';

const API_KEY = 'test-generation-key';

export async function apiPost(request, path, data) {
  const res = await request.post(path, {
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
    },
    data,
  });
  return res;
}

export async function apiGet(request, path) {
  return request.get(path, {
    headers: {
      'x-api-key': API_KEY,
    },
  });
}

export async function seedWorkflowScenario(request) {
  const stamp = Date.now();

  const deaconHouseholdRes = await apiPost(request, '/api/households', {
    lastName: `DeaconHH-${stamp}`,
  });
  expect(deaconHouseholdRes.ok()).toBeTruthy();
  const deaconHousehold = await deaconHouseholdRes.json();

  const deaconEmail = `deacon-${stamp}@example.test`;
  const deaconMemberRes = await apiPost(request, '/api/members', {
    householdId: deaconHousehold.id,
    firstName: 'Deacon',
    lastName: `User${stamp}`,
    relationship: 'head',
    gender: 'male',
    email: deaconEmail,
    phone: '515-555-0100',
    tags: ['deacon'],
  });
  expect(deaconMemberRes.ok()).toBeTruthy();
  const deaconMember = await deaconMemberRes.json();

  const targetHouseholdRes = await apiPost(request, '/api/households', {
    lastName: `TargetHH-${stamp}`,
    primaryPhone: '515-555-0199',
    address: {
      street: '123 Main St',
      city: 'Des Moines',
      state: 'IA',
      zipCode: '50309',
    },
  });
  expect(targetHouseholdRes.ok()).toBeTruthy();
  const targetHousehold = await targetHouseholdRes.json();

  const targetMemberRes = await apiPost(request, '/api/members', {
    householdId: targetHousehold.id,
    firstName: 'Target',
    lastName: `Member${stamp}`,
    relationship: 'head',
    gender: 'female',
    email: `target-${stamp}@example.test`,
    phone: '515-555-0111',
    tags: ['member', 'shut-in'],
  });
  expect(targetMemberRes.ok()).toBeTruthy();
  const targetMember = await targetMemberRes.json();

  const assignRes = await apiPost(request, `/api/households/${targetHousehold.id}/assignments`, {
    deaconIds: [deaconMember.id],
  });
  expect(assignRes.ok()).toBeTruthy();

  const contactRes = await apiPost(request, '/api/contacts', {
    memberId: [targetMember.id],
    deaconId: [deaconMember.id],
    contactType: 'phone',
    summary: `Initial seeded contact ${stamp}`,
    contactDate: new Date().toISOString(),
  });
  expect(contactRes.ok()).toBeTruthy();

  return {
    stamp,
    deaconEmail,
    deaconMemberId: deaconMember.id,
    targetHouseholdId: targetHousehold.id,
    targetMemberId: targetMember.id,
    targetMemberLastName: `Member${stamp}`,
    targetLastName: `TargetHH-${stamp}`,
  };
}

export async function loginAsEmail(page, email) {
  resetMailbox();

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
}

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
