import { test, expect } from '@playwright/test';

test('writes and reads households through API using simulator-backed S3 @smoke', async ({ request }) => {
  const createRes = await request.post('/api/households', {
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'test-generation-key',
    },
    data: {
      lastName: `Sim-${Date.now()}`,
    },
  });

  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  expect(created.id).toBeTruthy();

  const listRes = await request.get('/api/households', {
    headers: {
      'x-api-key': 'test-generation-key',
    },
  });

  expect(listRes.ok()).toBeTruthy();
  const payload = await listRes.json();
  expect(Array.isArray(payload.households)).toBeTruthy();
  expect(payload.households.some((h) => h._id === created.id || h.lastName === created.household?.lastName)).toBeTruthy();
});
