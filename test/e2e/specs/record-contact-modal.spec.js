import { test, expect } from '../support/browser-coverage.js';
import { apiPost, loginAsEmail, seedWorkflowScenario } from '../support/workflow-helpers.js';

async function createEditableContact(request, scenario) {
  const summary = `Edit mode contact ${scenario.stamp}`;
  const contactDate = '2099-01-15';

  const res = await apiPost(request, '/api/contacts', {
    memberId: [scenario.targetMemberId],
    deaconId: [scenario.deaconMemberId],
    contactType: 'visit',
    summary,
    contactDate,
    followUpRequired: true,
  });
  expect(res.ok()).toBeTruthy();
  const payload = await res.json();

  return {
    summary,
    contactDate,
    contactId: payload.contactId || payload.contact?._id || payload.id,
  };
}

test.describe('record-contact modal and edit-mode coverage', () => {
  test('participant modal opens, loads participants, and adds selected participant', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/record-contact.html?householdId=${scenario.targetHouseholdId}`);

    await page.getByRole('button', { name: /add participant/i }).click();
    const modal = page.locator('#participantModal');
    await expect(modal).toBeVisible();

    const participantCheckboxes = page.locator('#participantList input[name="participantId"]');
    await expect(participantCheckboxes.first()).toBeVisible();

    const selectedParticipantId = await participantCheckboxes.first().getAttribute('value');
    await participantCheckboxes.first().check();

    await page.getByRole('button', { name: /add selected/i }).click();
    await expect(modal).toBeHidden();

    await expect(page.locator(`#deaconsSection input[value="${selectedParticipantId}"]`)).toBeChecked();
  });

  test('edit mode prepopulates form fields and selected checkboxes', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    const editable = await createEditableContact(request, scenario);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/record-contact.html?householdId=${scenario.targetHouseholdId}&contactId=${editable.contactId}`);

    await expect(page.locator('#submitContactBtn')).toHaveText(/save changes/i);
    await expect(page.locator('#summary')).toHaveValue(editable.summary);
    await expect(page.locator('#contact-type')).toHaveValue('visit');
    await expect(page.locator('#follow-up-required')).toBeChecked();

    // formatDateForInput/applyContactToForm behavior appears via edit-mode date hydration.
    await expect(page.locator('#contact-date')).toHaveValue(editable.contactDate);
    await expect(page.locator(`#membersSection input[value="${scenario.targetMemberId}"]`)).toBeChecked();
    await expect(page.locator(`#deaconsSection input[value="${scenario.deaconMemberId}"]`)).toBeChecked();
  });

  test('participant modal close button hides modal', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/record-contact.html?householdId=${scenario.targetHouseholdId}`);

    await page.getByRole('button', { name: /add participant/i }).click();
    const modal = page.locator('#participantModal');
    await expect(modal).toBeVisible();

    await page.locator('#closeParticipantModalBtn').click();
    await expect(modal).toBeHidden();
  });
});
