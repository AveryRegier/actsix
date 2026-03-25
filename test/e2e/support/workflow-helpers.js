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

export async function seedMemberTagsScenario(request) {
  const stamp = Date.now();

  const deaconHouseholdRes = await apiPost(request, '/api/households', {
    lastName: `TagDeaconHH-${stamp}`,
  });
  expect(deaconHouseholdRes.ok()).toBeTruthy();
  const deaconHousehold = await deaconHouseholdRes.json();

  const deaconEmail = `tag-deacon-${stamp}@example.test`;
  const deaconMemberRes = await apiPost(request, '/api/members', {
    householdId: deaconHousehold.id,
    firstName: 'Tag',
    lastName: `Deacon${stamp}`,
    relationship: 'head',
    gender: 'male',
    email: deaconEmail,
    phone: '515-555-0200',
    tags: ['deacon'],
  });
  expect(deaconMemberRes.ok()).toBeTruthy();

  const visibleHouseholdRes = await apiPost(request, '/api/households', {
    lastName: `TagVisibleHH-${stamp}`,
    primaryPhone: '515-555-0201',
  });
  expect(visibleHouseholdRes.ok()).toBeTruthy();
  const visibleHousehold = await visibleHouseholdRes.json();

  const editableMemberRes = await apiPost(request, '/api/members', {
    householdId: visibleHousehold.id,
    firstName: 'Visible',
    lastName: `Editable${stamp}`,
    relationship: 'head',
    gender: 'female',
    email: `visible-editable-${stamp}@example.test`,
    phone: '515-555-0202',
    tags: ['member', 'shut-in'],
  });
  expect(editableMemberRes.ok()).toBeTruthy();
  const editableMember = await editableMemberRes.json();

  const widowMemberRes = await apiPost(request, '/api/members', {
    householdId: visibleHousehold.id,
    firstName: 'Visible',
    lastName: `Widow${stamp}`,
    relationship: 'other',
    gender: 'female',
    email: `visible-widow-${stamp}@example.test`,
    phone: '515-555-0203',
    tags: ['member', 'widow'],
  });
  expect(widowMemberRes.ok()).toBeTruthy();
  const widowMember = await widowMemberRes.json();

  const deceasedHouseholdRes = await apiPost(request, '/api/households', {
    lastName: `TagDeceasedHH-${stamp}`,
    primaryPhone: '515-555-0204',
  });
  expect(deceasedHouseholdRes.ok()).toBeTruthy();
  const deceasedHousehold = await deceasedHouseholdRes.json();

  const deceasedMemberRes = await apiPost(request, '/api/members', {
    householdId: deceasedHousehold.id,
    firstName: 'Hidden',
    lastName: `Deceased${stamp}`,
    relationship: 'head',
    gender: 'male',
    email: `hidden-deceased-${stamp}@example.test`,
    phone: '515-555-0205',
    tags: ['member', 'deceased'],
  });
  expect(deceasedMemberRes.ok()).toBeTruthy();
  const deceasedMember = await deceasedMemberRes.json();

  return {
    stamp,
    deaconEmail,
    editableMemberId: editableMember.id,
    editableMemberLastName: `Editable${stamp}`,
    widowMemberId: widowMember.id,
    widowMemberLastName: `Widow${stamp}`,
    deceasedMemberId: deceasedMember.id,
    deceasedMemberLastName: `Deceased${stamp}`,
    visibleHouseholdId: visibleHousehold.id,
  };
}

export async function seedTemporaryAddressScenario(request, options = {}) {
  const stamp = Date.now();

  const deaconHouseholdRes = await apiPost(request, '/api/households', {
    lastName: `TempDeaconHH-${stamp}`,
  });
  expect(deaconHouseholdRes.ok()).toBeTruthy();
  const deaconHousehold = await deaconHouseholdRes.json();

  const deaconEmail = `temp-deacon-${stamp}@example.test`;
  const deaconMemberRes = await apiPost(request, '/api/members', {
    householdId: deaconHousehold.id,
    firstName: 'Temp',
    lastName: `Deacon${stamp}`,
    relationship: 'head',
    gender: 'male',
    email: deaconEmail,
    phone: '515-555-0300',
    tags: ['deacon'],
  });
  expect(deaconMemberRes.ok()).toBeTruthy();
  const deaconMember = await deaconMemberRes.json();

  const householdRes = await apiPost(request, '/api/households', {
    lastName: `TempHH-${stamp}`,
    primaryPhone: '515-555-0301',
    address: {
      street: '456 Elm St',
      city: 'Des Moines',
      state: 'IA',
      zipCode: '50309',
    },
  });
  expect(householdRes.ok()).toBeTruthy();
  const household = await householdRes.json();

  const locationName = `Mercy Temp ${stamp}`;
  const locationRes = await apiPost(request, '/api/common-locations', {
    name: locationName,
    type: 'hospital',
    address: {
      street: '111 Care Way',
      city: 'Des Moines',
      state: 'IA',
      zipCode: '50309',
    },
    phone: '515-555-0302',
    visitingHours: '9am-5pm',
  });
  expect(locationRes.ok()).toBeTruthy();
  const locationPayload = await locationRes.json();
  const locationId = locationPayload.locationId || locationPayload.location?._id;

  const memberPayload = {
    householdId: household.id,
    firstName: 'Patient',
    lastName: `Member${stamp}`,
    relationship: 'head',
    gender: 'female',
    email: `temp-member-${stamp}@example.test`,
    phone: '515-555-0303',
    tags: ['member'],
  };

  if (options.withTemporaryAddress) {
    memberPayload.temporaryAddress = {
      locationId,
      roomNumber: options.roomNumber || `Room ${String(stamp).slice(-3)}`,
      startDate: options.startDate || '2026-03-01',
      notes: options.notes || `Recovery ${stamp}`,
      isActive: true,
    };
  }

  const memberRes = await apiPost(request, '/api/members', memberPayload);
  expect(memberRes.ok()).toBeTruthy();
  const member = await memberRes.json();

  const assignRes = await apiPost(request, `/api/households/${household.id}/assignments`, {
    deaconIds: [deaconMember.id],
  });
  expect(assignRes.ok()).toBeTruthy();

  return {
    stamp,
    deaconEmail,
    deaconMemberId: deaconMember.id,
    householdId: household.id,
    memberId: member.id,
    memberLastName: `Member${stamp}`,
    locationId,
    locationName,
    roomNumber: memberPayload.temporaryAddress?.roomNumber || null,
    notes: memberPayload.temporaryAddress?.notes || null,
    startDate: memberPayload.temporaryAddress?.startDate || null,
  };
}

export async function seedCommonLocationCrudScenario(request) {
  const stamp = Date.now();

  const staffHouseholdRes = await apiPost(request, '/api/households', {
    lastName: `LocStaffHH-${stamp}`,
  });
  expect(staffHouseholdRes.ok()).toBeTruthy();
  const staffHousehold = await staffHouseholdRes.json();

  const staffEmail = `loc-staff-${stamp}@example.test`;
  const staffMemberRes = await apiPost(request, '/api/members', {
    householdId: staffHousehold.id,
    firstName: 'Location',
    lastName: `Staff${stamp}`,
    relationship: 'head',
    gender: 'female',
    email: staffEmail,
    phone: '515-555-0400',
    tags: ['staff'],
  });
  expect(staffMemberRes.ok()).toBeTruthy();
  const staffMember = await staffMemberRes.json();

  const householdRes = await apiPost(request, '/api/households', {
    lastName: `LocTargetHH-${stamp}`,
    primaryPhone: '515-555-0401',
    address: {
      street: '789 Oak St',
      city: 'Des Moines',
      state: 'IA',
      zipCode: '50309',
    },
  });
  expect(householdRes.ok()).toBeTruthy();
  const household = await householdRes.json();

  const memberRes = await apiPost(request, '/api/members', {
    householdId: household.id,
    firstName: 'Location',
    lastName: `Member${stamp}`,
    relationship: 'head',
    gender: 'male',
    email: `loc-member-${stamp}@example.test`,
    phone: '515-555-0402',
    tags: ['member'],
  });
  expect(memberRes.ok()).toBeTruthy();
  const member = await memberRes.json();

  const assignRes = await apiPost(request, `/api/households/${household.id}/assignments`, {
    deaconIds: [staffMember.id],
  });
  expect(assignRes.ok()).toBeTruthy();

  return {
    stamp,
    staffEmail,
    staffMemberId: staffMember.id,
    householdId: household.id,
    memberId: member.id,
    memberLastName: `Member${stamp}`,
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
