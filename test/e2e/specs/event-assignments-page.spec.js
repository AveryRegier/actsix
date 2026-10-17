import fs from 'fs';
import path from 'path';
import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsSeededMember } from '../support/site-session-helpers.js';

function readCancelSeed() {
  const seed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'test-results', 'e2e-summary-seed.json'), 'utf8'));
  return seed.cancelEvents;
}

test.describe('event assignments page (site-only)', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/event-assignments.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });

  test('date view shows real Filled counts and Clear Assignment empties the position', async ({ page }) => {
    const seed = readCancelSeed().assignClear;
    await authenticateAsSeededMember(page, 'staff');

    await page.goto(`/event-assignments.html?serviceDate=${encodeURIComponent(seed.serviceDate)}`);
    await expect(page.getByText('Filled: 1/1')).toBeVisible();

    await page.locator('.assignment-edit-trigger', { hasText: 'SortStaff' }).click();
    await page.getByRole('button', { name: 'Clear Assignment' }).click();

    await expect(page.getByText('Assignments updated.')).toBeVisible();
    await expect(page.getByText('Filled: 0/1')).toBeVisible();
    await expect(page.locator('.assignment-edit-trigger', { hasText: 'Open' })).toHaveCount(1);
    await expect(page.locator('.assignment-edit-trigger', { hasText: 'SortStaff' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('Filled: 0/1')).toBeVisible();

    await page.goto('/sign-ups.html');
    const card = page.locator('.signups-event-card', { hasText: seed.title });
    await expect(card.getByText('Filled: 0/1')).toBeVisible();
  });

  test('single event view shows real Filled count', async ({ page }) => {
    const seed = readCancelSeed().denied;
    await authenticateAsSeededMember(page, 'staff');

    await page.goto(`/event-assignments.html?eventId=${encodeURIComponent(seed.eventId)}`);
    await expect(page.getByText(/Filled: \d+\/1/)).toBeVisible();
  });

  test('deacon without leader access does not see Cancel Event', async ({ page }) => {
    const seed = readCancelSeed();
    await authenticateAsSeededMember(page, 'deacon');

    await page.goto(`/event-assignments.html?eventId=${encodeURIComponent(seed.denied.eventId)}`);
    await expect(page.locator('#assignmentsTableWrap')).toBeVisible();
    await expect(page.locator('.cancel-event-button')).toHaveCount(0);
  });

  test('date view shows one Cancel button per activity group, named for the event type', async ({ page }) => {
    const seed = readCancelSeed();
    await authenticateAsSeededMember(page, 'staff');

    await page.goto(`/event-assignments.html?serviceDate=${encodeURIComponent(seed.denied.serviceDate)}`);
    await expect(page.locator('#assignmentsTableWrap')).toBeVisible();
    await expect(page.locator('.cancel-event-button')).toHaveCount(1);
    await expect(page.locator('.cancel-event-button')).toHaveText(`Cancel ${seed.denied.title}`);
  });

  test('cancelling from the date view removes the whole activity, including its setup', async ({ page }) => {
    const seed = readCancelSeed();
    await authenticateAsSeededMember(page, 'staff');

    await page.goto(`/event-assignments.html?serviceDate=${encodeURIComponent(seed.dateView.serviceDate)}`);
    const cancelButton = page.locator('.cancel-event-button');
    await expect(cancelButton).toHaveCount(1);
    await expect(page.getByText(`${seed.dateView.title} Setup`).first()).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await cancelButton.click();
    await expect(page.locator('.cancel-event-button')).toHaveCount(0);
    await expect(page.getByText(seed.dateView.title)).toHaveCount(0);

    await page.goto('/sign-ups.html');
    await expect(page.locator('.signups-event-card', { hasText: seed.dateView.title })).toHaveCount(0);
  });

  test('staff can dismiss then confirm cancelling an event', async ({ page }) => {    const seed = readCancelSeed();
    await authenticateAsSeededMember(page, 'staff');

    await page.goto('/sign-ups.html');
    // Parent event plus its auto-scheduled setup both show up before cancelling.
    await expect(page.locator('.signups-event-card', { hasText: seed.flow.title })).toHaveCount(2);

    await page.goto(`/event-assignments.html?eventId=${encodeURIComponent(seed.flow.eventId)}`);
    const cancelButton = page.locator('.cancel-event-button');
    await expect(cancelButton).toBeVisible();

    page.once('dialog', (dialog) => dialog.dismiss());
    await cancelButton.click();
    await expect(cancelButton).toBeVisible();
    await expect(page.getByText('Event cancelled.')).toHaveCount(0);

    page.once('dialog', (dialog) => dialog.accept());
    await cancelButton.click();
    await expect(page.getByText('Event cancelled.')).toBeVisible();
    await expect(page.locator('.cancel-event-button')).toHaveCount(0);

    await page.goto('/sign-ups.html');
    await expect(page.locator('.signups-event-card', { hasText: seed.flow.title })).toHaveCount(0);
  });
});
