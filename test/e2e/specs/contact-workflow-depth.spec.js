import { test, expect } from '../support/browser-coverage.js';
import { apiGet, loginAsEmail, seedTemporaryAddressScenario, seedWorkflowScenario } from '../support/workflow-helpers.js';

async function ensureContactParticipantsSelected(page) {
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
}

test.describe('feature4 contact workflow depth', () => {
  test('record-contact persists follow-up required and voicemail type', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    const summary = `Feature4 voicemail follow-up ${scenario.stamp}`;
    await page.goto(`/record-contact.html?householdId=${scenario.targetHouseholdId}`);

    await page.locator('#contact-date').fill('2099-01-01');
    await page.locator('#contact-type').selectOption('voicemail');
    await page.locator('#summary').fill(summary);
    await page.locator('#follow-up-required').check();
    await ensureContactParticipantsSelected(page);

    await page.getByRole('button', { name: /submit contact/i }).click();
    await expect(page).toHaveURL(new RegExp(`household\\.html[?]id=${scenario.targetHouseholdId}`));

    const contactsRes = await apiGet(request, `/api/households/${scenario.targetHouseholdId}/contacts`);
    expect(contactsRes.ok()).toBeTruthy();
    const contactsPayload = await contactsRes.json();
    const saved = contactsPayload.contacts.find((c) => String(c.summary || '') === summary);
    expect(saved).toBeTruthy();
    expect(saved.contactType).toBe('voicemail');
    expect(saved.followUpRequired).toBe(true);
  });

  test('contact-summary report reflects church contact type and summary text', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    const summary = `Feature4 church summary ${scenario.stamp}`;
    await page.goto(`/record-contact.html?householdId=${scenario.targetHouseholdId}`);

    await page.locator('#contact-date').fill('2099-01-02');
    await page.locator('#contact-type').selectOption('church');
    await page.locator('#summary').fill(summary);
    await ensureContactParticipantsSelected(page);

    await page.getByRole('button', { name: /submit contact/i }).click();
    await expect(page).toHaveURL(new RegExp(`household\\.html[?]id=${scenario.targetHouseholdId}`));

    await page.goto('/contact-summary.html');
    const summaryRow = page.locator(`tr[data-household-id="${scenario.targetHouseholdId}"]`).first();
    await expect(summaryRow).toContainText(summary);
    await expect(summaryRow).toContainText(/Spoke at church/i);
  });

  test('contact-summary renders temporary location details in summary rows', async ({ page, request }) => {
    const scenario = await seedTemporaryAddressScenario(request, {
      withTemporaryAddress: true,
      roomNumber: 'Room 207',
      notes: 'Recovering well',
      startDate: '2026-03-01',
    });
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/contact-summary.html');

    const tempInfo = page.locator(`td[data-household-id="${scenario.householdId}"] .temp-location-info`).first();
    await expect(tempInfo).toContainText('Temporary Location:');
    await expect(tempInfo).toContainText(scenario.locationName);
    await expect(tempInfo).toContainText('Room/Unit: Room 207');
    await expect(tempInfo).toContainText('Recovering well');
  });
});
