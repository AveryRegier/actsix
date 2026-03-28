import { test, expect } from '../support/browser-coverage.js';
import { loginAsEmail, seedWorkflowScenario } from '../support/workflow-helpers.js';

async function findZipDataCandidates(page) {
  return page.evaluate(async () => {
    const response = await fetch('/iowa_zip_codes.json');
    const data = await response.json();

    let multiZip = null;
    let singleCity = null;
    const zipToCities = new Map();

    for (const county of Object.keys(data || {})) {
      const entries = Array.isArray(data[county]) ? data[county] : [];
      for (const entry of entries) {
        if (!entry || !Array.isArray(entry.zips)) {
          continue;
        }

        if (!singleCity && entry.city && entry.zips.length === 1) {
          singleCity = { city: entry.city, zip: entry.zips[0] };
        }

        for (const zip of entry.zips) {
          if (!zipToCities.has(zip)) {
            zipToCities.set(zip, []);
          }
          zipToCities.get(zip).push(entry.city);
        }
      }
    }

    for (const [zip, cities] of zipToCities.entries()) {
      const distinct = [...new Set(cities.filter(Boolean))];
      if (distinct.length > 1) {
        multiZip = { zip, cities: distinct };
        break;
      }
    }

    return { multiZip, singleCity };
  });
}

test.describe('address utility edge cases', () => {
  test('street full-address parsing supports ZIP+4 and fills split fields', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/edit-household.html?householdId=${scenario.targetHouseholdId}`);
    await expect(page.locator('#edit-household-form')).toBeVisible();

    await page.locator('#addressStreet').fill('123 Main St, Des Moines, Iowa 50322-4931');

    await expect(page.locator('#addressStreet')).toHaveValue('123 Main St');
    await expect(page.locator('#addressCity')).toHaveValue('Des Moines');
    await expect(page.locator('#addressState')).toHaveValue('IA');
    await expect(page.locator('#addressZipCode')).toHaveValue('50322-4931');
  });

  test('zip blur corrects invalid city and city blur fills zip for single-zip city', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/edit-household.html?householdId=${scenario.targetHouseholdId}`);
    await expect(page.locator('#edit-household-form')).toBeVisible();

    const candidates = await findZipDataCandidates(page);
    expect(candidates.multiZip).toBeTruthy();
    expect(candidates.singleCity).toBeTruthy();

    await page.locator('#addressCity').fill('NotARealIowaCity');
    await page.locator('#addressZipCode').fill(`${candidates.multiZip.zip}-1234`);
    await page.locator('#addressZipCode').blur();

    const correctedCity = await page.locator('#addressCity').inputValue();
    expect(candidates.multiZip.cities).toContain(correctedCity);
    await expect(page.locator('#addressState')).toHaveValue('IA');

    await page.locator('#addressCity').fill(candidates.singleCity.city);
    await page.locator('#addressZipCode').fill('');
    await page.locator('#addressCity').blur();

    await expect(page.locator('#addressZipCode')).toHaveValue(candidates.singleCity.zip);
  });
});