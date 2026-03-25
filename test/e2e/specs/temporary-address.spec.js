import { test, expect } from '../support/browser-coverage.js';
import { apiGet, loginAsEmail, seedTemporaryAddressScenario } from '../support/workflow-helpers.js';

test.describe('feature2 temporary address member workflow', () => {
  test('edit-member assigns a temporary location and household view renders it', async ({ page, request }) => {
    const scenario = await seedTemporaryAddressScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    const roomNumber = `Room ${String(scenario.stamp).slice(-4)}`;
    const notes = `Post-surgery recovery ${scenario.stamp}`;

    await page.goto(`/edit-member.html?memberId=${scenario.memberId}&householdId=${scenario.householdId}`);

    const locationDropdown = page.locator('#tempLocationDropdown');
    await expect(locationDropdown).toBeVisible();
    await locationDropdown.selectOption(scenario.locationName);
    await expect(page.locator('#tempLocationName')).toHaveText(scenario.locationName);
    await page.locator('#tempRoomNumber').fill(roomNumber);
    await page.locator('#tempNotes').fill(notes);
    await page.getByRole('button', { name: /save member/i }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe('/household.html');
    await expect.poll(() => new URL(page.url()).searchParams.get('id')).toBe(scenario.householdId);

    const memberRes = await apiGet(request, `/api/members/${scenario.memberId}`);
    expect(memberRes.ok()).toBeTruthy();
    const payload = await memberRes.json();
    expect(payload.member.temporaryAddress).toMatchObject({
      locationId: scenario.locationId,
      roomNumber,
      notes,
      isActive: true,
    });
    expect(payload.member.temporaryAddress.startDate).toBeTruthy();

    const memberCard = page.locator(`[data-member-id="${scenario.memberId}"]`);
    const tempInfo = memberCard.locator('.temp-location-info');
    await expect(tempInfo).toContainText('Temporary Location:');
    await expect(tempInfo).toContainText(scenario.locationName);
    await expect(tempInfo).toContainText(roomNumber);
    await expect(tempInfo).toContainText(notes);
    await expect(tempInfo).toContainText('Since:');
  });

  test('edit-member can clear an existing temporary location', async ({ page, request }) => {
    const scenario = await seedTemporaryAddressScenario(request, {
      withTemporaryAddress: true,
      roomNumber: `Room ${String(Date.now()).slice(-4)}`,
      notes: 'Existing temporary stay',
      startDate: '2026-03-01',
    });
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/edit-member.html?memberId=${scenario.memberId}&householdId=${scenario.householdId}`);

    await expect(page.locator('#tempLocationDropdown')).toHaveValue(scenario.locationName);
    await expect(page.locator('#tempLocationDisplay')).toBeVisible();
    await expect(page.locator('#tempRoomNumber')).toHaveValue(scenario.roomNumber);
    await expect(page.locator('#tempNotes')).toHaveValue(scenario.notes);

    await page.locator('#clearTempBtn').click();
    await expect(page.locator('#tempLocationDropdown')).toHaveValue('');
    await expect(page.locator('#tempLocationDisplay')).toBeHidden();
    await expect(page.locator('#tempRoomNumber')).toHaveValue('');
    await expect(page.locator('#tempNotes')).toHaveValue('');

    await page.getByRole('button', { name: /save member/i }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/household.html');

    const memberRes = await apiGet(request, `/api/members/${scenario.memberId}`);
    expect(memberRes.ok()).toBeTruthy();
    const payload = await memberRes.json();
    expect(payload.member.temporaryAddress).toBeNull();

    const memberCard = page.locator(`[data-member-id="${scenario.memberId}"]`);
    await expect(memberCard.locator('.temp-location-info')).toHaveCount(0);
    await expect(memberCard).not.toContainText('Temporary Location:');
    await expect(memberCard).not.toContainText(scenario.locationName);
  });
});