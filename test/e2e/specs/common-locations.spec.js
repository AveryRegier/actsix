import { test, expect } from '../support/browser-coverage.js';
import { apiGet, loginAsEmail, seedCommonLocationCrudScenario } from '../support/workflow-helpers.js';

async function browserApi(page, path, method = 'GET', body) {
  return page.evaluate(async ({ path, method, body }) => {
    const token = localStorage.getItem('authToken');
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(path, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      json,
    };
  }, { path, method, body });
}

test.describe('feature3 common locations CRUD', () => {
  test('staff can create and update location and member UI reflects changes', async ({ page, request }) => {
    const scenario = await seedCommonLocationCrudScenario(request);
    await loginAsEmail(page, scenario.staffEmail);

    const createdName = `Feature3 Create ${scenario.stamp}`;
    const updatedName = `Feature3 Update ${scenario.stamp}`;
    const roomNumber = `Suite ${String(scenario.stamp).slice(-3)}`;
    const notes = `Rehab transition ${scenario.stamp}`;

    const createRes = await browserApi(page, '/api/common-locations', 'POST', {
      name: createdName,
      type: 'rehab',
      address: {
        street: '900 Recovery Ave',
        city: 'Des Moines',
        state: 'IA',
        zipCode: '50309',
      },
      phone: '515-555-0403',
      website: 'https://example.org/location',
      visitingHours: '8am-8pm',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.json?.locationId).toBeTruthy();
    const locationId = createRes.json.locationId;

    await page.goto(`/edit-member.html?memberId=${scenario.memberId}&householdId=${scenario.householdId}`);
    const dropdown = page.locator('#tempLocationDropdown');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('option')).toContainText([`${createdName} (rehab)`]);

    const updateRes = await browserApi(page, `/api/common-locations/${locationId}`, 'PUT', {
      name: updatedName,
      type: 'hospital',
      address: {
        street: '901 Recovery Ave',
        city: 'Des Moines',
        state: 'IA',
        zipCode: '50310',
      },
      phone: '515-555-0404',
      visitingHours: '24/7',
    });
    expect(updateRes.ok).toBeTruthy();

    await page.reload();
    await expect(dropdown.locator('option')).toContainText([`${updatedName} (hospital)`]);
    await expect(dropdown.locator('option')).not.toContainText([`${createdName} (rehab)`]);

    await dropdown.selectOption(updatedName);
    await page.locator('#tempRoomNumber').fill(roomNumber);
    await page.locator('#tempNotes').fill(notes);
    await page.getByRole('button', { name: /save member/i }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe('/household.html');
    const memberCard = page.locator(`[data-member-id="${scenario.memberId}"]`);
    await expect(memberCard.locator('.temp-location-info')).toContainText(updatedName);
    await expect(memberCard.locator('.temp-location-info')).toContainText(roomNumber);
    await expect(memberCard.locator('.temp-location-info')).toContainText(notes);

    const memberRes = await apiGet(request, `/api/members/${scenario.memberId}`);
    expect(memberRes.ok()).toBeTruthy();
    const payload = await memberRes.json();
    expect(payload.member.temporaryAddress?.locationId).toBe(locationId);
  });

  test('delete in-use location fails until member temporary location is cleared', async ({ page, request }) => {
    const scenario = await seedCommonLocationCrudScenario(request);
    await loginAsEmail(page, scenario.staffEmail);

    const locationName = `Feature3 InUse ${scenario.stamp}`;
    const createRes = await browserApi(page, '/api/common-locations', 'POST', {
      name: locationName,
      type: 'nursing_home',
      address: {
        street: '700 Care Home Ln',
        city: 'Des Moines',
        state: 'IA',
        zipCode: '50309',
      },
      phone: '515-555-0405',
    });
    expect(createRes.status).toBe(201);
    const locationId = createRes.json.locationId;

    await page.goto(`/edit-member.html?memberId=${scenario.memberId}&householdId=${scenario.householdId}`);
    await page.locator('#tempLocationDropdown').selectOption(locationName);
    await page.locator('#tempRoomNumber').fill('Room 12');
    await page.locator('#tempNotes').fill('In use for delete validation');
    await page.getByRole('button', { name: /save member/i }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/household.html');

    const deleteWhileInUse = await browserApi(page, `/api/common-locations/${locationId}`, 'DELETE');
    expect(deleteWhileInUse.status).toBe(400);
    expect(deleteWhileInUse.json?.error).toMatch(/Cannot delete location/i);
    expect(deleteWhileInUse.json?.message || '').toMatch(/reassign them first/i);

    await page.goto(`/edit-member.html?memberId=${scenario.memberId}&householdId=${scenario.householdId}`);
    await page.locator('#clearTempBtn').click();
    await page.getByRole('button', { name: /save member/i }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/household.html');

    const deleteAfterClear = await browserApi(page, `/api/common-locations/${locationId}`, 'DELETE');
    expect(deleteAfterClear.ok).toBeTruthy();

    const deletedLookup = await browserApi(page, `/api/common-locations/${locationId}`);
    expect(deletedLookup.status).toBe(404);

    await page.goto(`/edit-member.html?memberId=${scenario.memberId}&householdId=${scenario.householdId}`);
    await expect(page.locator('#tempLocationDropdown option')).not.toContainText([`${locationName} (nursing_home)`]);
  });
});