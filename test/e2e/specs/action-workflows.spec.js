import { test, expect } from '@playwright/test';
import { apiGet, loginAsEmail, seedWorkflowScenario } from '../support/workflow-helpers.js';

test.describe('phase4 action workflows', () => {
  test('unauthenticated users are redirected from protected pages', async ({ page }) => {
    const paths = [
      '/members.html',
      '/household.html?id=missing',
      '/edit-member.html',
      '/edit-household.html?householdId=missing',
      '/assign-deacons.html?householdId=missing',
      '/record-contact.html?householdId=missing',
      '/contact-summary.html',
      '/deacon-quick-contact.html',
    ];

    for (const path of paths) {
      await page.goto(path);
      await expect(page).toHaveURL(/email-login\.html/);
    }
  });

  test('index page shows navigation cards after login', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/index.html');
    await expect(page.locator('a.nav-card[href="deacon-quick-contact.html"]')).toBeVisible();
    await expect(page.locator('a.nav-card[href="contact-summary.html"]')).toBeVisible();
    await expect(page.locator('a.nav-card[href="members.html"]')).toBeVisible();
  });

  test('members page renders seeded members and tags', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/members.html');
    await expect(page.getByText(new RegExp(`Member${scenario.stamp}`))).toBeVisible();
    await expect(page.locator('#tagFilter')).toBeVisible();
  });

  test('household page renders household details and action links', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    await expect(page.locator('#householdTitle')).toContainText('Household');
    await expect(page.locator('#addMemberBtn')).toHaveAttribute('href', new RegExp(`householdId=${scenario.targetHouseholdId}`));
    await expect(page.locator('#assignDeaconBtn')).toHaveAttribute('href', new RegExp(`householdId=${scenario.targetHouseholdId}`));
  });

  test('edit-household updates notes workflow', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    const notes = `phase4-edit-household-${scenario.stamp}`;
    await page.goto(`/edit-household.html?householdId=${scenario.targetHouseholdId}`);
    await page.locator('#notes').fill(notes);
    await page.getByRole('button', { name: /save changes/i }).click();

    const getRes = await apiGet(request, `/api/households/${scenario.targetHouseholdId}`);
    expect(getRes.ok()).toBeTruthy();
    const household = await getRes.json();
    expect(household.notes).toBe(notes);
  });

  test('edit-member updates phone workflow', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    const phone = `515-777-${String(scenario.stamp).slice(-4)}`;
    await page.goto(`/edit-member.html?memberId=${scenario.targetMemberId}&householdId=${scenario.targetHouseholdId}`);
    await page.locator('#phone').fill(phone);
    await page.getByRole('button', { name: /save member/i }).click();

    const getRes = await apiGet(request, `/api/members/${scenario.targetMemberId}`);
    expect(getRes.ok()).toBeTruthy();
    const payload = await getRes.json();
    expect(payload.member.phone).toBe(phone);
  });

  test('assign-deacons workflow posts selected deacons', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/assign-deacons.html?householdId=${scenario.targetHouseholdId}`);
    await expect(page.getByRole('button', { name: /assign selected deacons/i })).toBeVisible();

    const checkboxes = page.locator('#deaconList input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();
    if (!(await checkboxes.first().isChecked())) {
      await checkboxes.first().check();
    }

    await page.getByRole('button', { name: /assign selected deacons/i }).click();

    const assignmentsRes = await apiGet(request, `/api/households/${scenario.targetHouseholdId}/assignments`);
    expect(assignmentsRes.ok()).toBeTruthy();
    const data = await assignmentsRes.json();
    expect(Array.isArray(data.assignments)).toBeTruthy();
    expect(data.assignments.length).toBeGreaterThan(0);
  });

  test('record-contact workflow submits a contact', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    const summary = `Phase4 contact summary ${scenario.stamp}`;
    await page.goto(`/record-contact.html?householdId=${scenario.targetHouseholdId}`);

    await page.locator('#summary').fill(summary);

    const memberCheckbox = page.locator('#membersSection input[type="checkbox"]').first();
    await expect(memberCheckbox).toBeVisible();
    if (!(await memberCheckbox.isChecked())) {
      await memberCheckbox.check();
    }

    const deaconCheckbox = page.locator('#deaconsSection input[type="checkbox"]').first();
    await expect(deaconCheckbox).toBeVisible();
    if (!(await deaconCheckbox.isChecked())) {
      await deaconCheckbox.check();
    }

    await page.getByRole('button', { name: /submit contact/i }).click();
    await expect(page).toHaveURL(new RegExp(`household\\.html[?]id=${scenario.targetHouseholdId}`));

    const contactsRes = await apiGet(request, `/api/households/${scenario.targetHouseholdId}/contacts`);
    expect(contactsRes.ok()).toBeTruthy();
    const contactsData = await contactsRes.json();
    expect(contactsData.contacts.some((c) => String(c.summary || '').includes(summary))).toBeTruthy();
  });

  test('contact-summary page shows household and links', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/contact-summary.html');
    await expect(page.getByRole('heading', { name: /contact summary report/i })).toBeVisible();
    await expect(page.getByText(new RegExp(`TargetHH-${scenario.stamp}`))).toBeVisible();
    await expect(page.locator(`a[href="assign-deacons.html?householdId=${scenario.targetHouseholdId}"]`).first()).toBeVisible();
  });

  test('deacon quick contact page shows record action', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/deacon-quick-contact.html?deaconMemberId=${scenario.deaconMemberId}`);
    await expect(page.getByRole('heading', { name: /deacon quick contact/i })).toBeVisible();

    const recordLink = page.locator('a.record-btn').first();
    await expect(recordLink).toBeVisible();
    await expect(recordLink).toHaveAttribute('href', new RegExp(`householdId=${scenario.targetHouseholdId}`));
  });
});
