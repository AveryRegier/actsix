import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { findLatestCodeForEmail, resetMailbox } from '../../harness/fake-mailbox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, '..', '..', '..', 'site', 'help', 'images');

const API_KEY = 'test-generation-key';

// Demo persona constants — deterministic, privacy-safe data for all screenshots
export const DEMO = {
  deaconEmail: 'demo-deacon@help.test',
  deaconFirstName: 'Mark',
  deaconLastName: 'Smith',
  staffEmail: 'demo-staff@help.test',
  staffFirstName: 'Grace',
  staffLastName: 'Williams',
  helperEmail: 'demo-helper@help.test',
  helperFirstName: 'Ruth',
  helperLastName: 'Evans',
  memberFirstName: 'Beth',
  memberLastName: 'Johnson',
  memberEmail: 'demo-member@help.test',
  householdLastName: 'Johnson',
  locationName: 'Mercy General Hospital',
  locationRoom: '214',
  householdPhone: '515-555-0100',
  householdStreet: '123 Maple Street',
  householdCity: 'Des Moines',
  householdState: 'IA',
  householdZip: '50309',
};

async function apiCall(request, method, urlPath, data) {
  const opts = {
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
    },
  };
  if (data) opts.data = data;
  if (method === 'POST') return request.post(urlPath, opts);
  if (method === 'PATCH') return request.patch(urlPath, opts);
  return request.get(urlPath, { headers: opts.headers });
}

/**
 * Seeds deterministic demo personas.
 * Clears existing demo households by searching for the known last name first.
 * Returns an object with all created IDs.
 */
export async function seedDemoData(request) {
  // Ensure images directory exists
  await fs.mkdir(imagesDir, { recursive: true });

  // Create deacon household
  const deaconHHRes = await apiCall(request, 'POST', '/api/households', {
    lastName: DEMO.deaconLastName + '-Deacon',
    primaryPhone: '515-555-0099',
  });
  const deaconHH = await deaconHHRes.json();

  // Create deacon member
  const deaconRes = await apiCall(request, 'POST', '/api/members', {
    householdId: deaconHH.id,
    firstName: DEMO.deaconFirstName,
    lastName: DEMO.deaconLastName,
    relationship: 'head',
    gender: 'male',
    email: DEMO.deaconEmail,
    phone: '515-555-0098',
    tags: ['deacon'],
  });
  const deacon = await deaconRes.json();

  // Create staff member
  const staffHHRes = await apiCall(request, 'POST', '/api/households', {
    lastName: DEMO.staffLastName + '-Staff',
  });
  const staffHH = await staffHHRes.json();
  const staffRes = await apiCall(request, 'POST', '/api/members', {
    householdId: staffHH.id,
    firstName: DEMO.staffFirstName,
    lastName: DEMO.staffLastName,
    relationship: 'head',
    gender: 'female',
    email: DEMO.staffEmail,
    phone: '515-555-0097',
    tags: ['staff'],
  });
  const staff = await staffRes.json();

  // Create helper member
  const helperHHRes = await apiCall(request, 'POST', '/api/households', {
    lastName: DEMO.helperLastName + '-Helper',
  });
  const helperHH = await helperHHRes.json();
  const helperRes = await apiCall(request, 'POST', '/api/members', {
    householdId: helperHH.id,
    firstName: DEMO.helperFirstName,
    lastName: DEMO.helperLastName,
    relationship: 'head',
    gender: 'female',
    email: DEMO.helperEmail,
    phone: '515-555-0096',
    tags: ['helper'],
  });
  const helper = await helperRes.json();

  // Create member household (the "care" household)
  const memberHHRes = await apiCall(request, 'POST', '/api/households', {
    lastName: DEMO.householdLastName,
    primaryPhone: DEMO.householdPhone,
    address: {
      street: DEMO.householdStreet,
      city: DEMO.householdCity,
      state: DEMO.householdState,
      zipCode: DEMO.householdZip,
    },
  });
  const memberHH = await memberHHRes.json();

  // Create member
  const memberRes = await apiCall(request, 'POST', '/api/members', {
    householdId: memberHH.id,
    firstName: DEMO.memberFirstName,
    lastName: DEMO.memberLastName,
    relationship: 'head',
    gender: 'female',
    email: DEMO.memberEmail,
    phone: '515-555-0095',
    tags: ['member', 'shut-in'],
  });
  const member = await memberRes.json();

  // Create a common location
  const locationRes = await apiCall(request, 'POST', '/api/common-locations', {
    name: DEMO.locationName,
    type: 'hospital',
    address: {
      street: '500 Medical Parkway',
      city: DEMO.householdCity,
      state: DEMO.householdState,
      zipCode: DEMO.householdZip,
    },
    phone: '515-555-0200',
    visitingHours: '8am-8pm',
  });
  const locationPayload = await locationRes.json();
  const locationId = locationPayload.locationId || locationPayload.location?._id;

  // Assign deacon to member household
  await apiCall(request, 'POST', `/api/households/${memberHH.id}/assignments`, {
    deaconIds: [deacon.id],
  });

  // Seed realistic, varied examples so help screenshots model useful note quality.
  const now = new Date();
  const seededContacts = [
    {
      contactType: 'visit',
      summary: 'In-person visit at Mercy General Hospital, Room 214. Beth shared that physical therapy is helping; prayed together and planned a Friday follow-up call.',
      contactDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      contactType: 'phone',
      summary: 'Phone check-in with Beth and family. Confirmed transportation for Tuesday oncology appointment and coordinated meal support for this week.',
      contactDate: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      contactType: 'text',
      summary: 'Text follow-up: medications were refilled and family requested prayer for restful sleep before next treatment.',
      contactDate: now.toISOString(),
    },
  ];

  for (const contact of seededContacts) {
    await apiCall(request, 'POST', '/api/contacts', {
      memberId: [member.id],
      deaconId: [deacon.id],
      contactType: contact.contactType,
      summary: contact.summary,
      contactDate: contact.contactDate,
    });
  }

  return {
    deaconId: deacon.id,
    deaconHHId: deaconHH.id,
    staffId: staff.id,
    staffHHId: staffHH.id,
    helperId: helper.id,
    helperHHId: helperHH.id,
    memberId: member.id,
    memberHHId: memberHH.id,
    locationId,
  };
}

/**
 * Log in using the fake mailbox flow.
 */
export async function loginAsEmail(page, email) {
  resetMailbox();
  page.on('dialog', async (dialog) => { await dialog.accept(); });

  await page.goto('/email-login.html');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole('button', { name: /send validation code/i }).click();
  const code = await waitForCode(email);
  await page.getByLabel(/validation code/i).fill(code);
  await page.getByRole('button', { name: /validate code/i }).click();
  await page.waitForURL(/\/$/, { timeout: 10_000 });
}

async function waitForCode(email, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const code = findLatestCodeForEmail(email);
    if (code) return code;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for code for ${email}`);
}

/**
 * Highlight a UI element with a colored annotation overlay.
 * color: 'orange' | 'blue' | 'green'
 */
export async function highlightElement(page, locator, color = 'orange') {
  const colors = {
    orange: { border: '#ff6b00', bg: 'rgba(255, 107, 0, 0.08)' },
    blue:   { border: '#0066cc', bg: 'rgba(0, 102, 204, 0.08)' },
    green:  { border: '#00a651', bg: 'rgba(0, 166, 81, 0.08)' },
  };
  const { border, bg } = colors[color] || colors.orange;

  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;

  await page.evaluate(({ x, y, width, height, border, bg }) => {
    const overlay = document.createElement('div');
    overlay.className = '__help-highlight__';
    Object.assign(overlay.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: `3px dashed ${border}`,
      background: bg,
      pointerEvents: 'none',
      zIndex: '99999',
      boxSizing: 'border-box',
    });
    document.body.appendChild(overlay);
  }, { ...box, border, bg });
}

/**
 * Take a help screenshot and save it to site/help/images/<filename>.
 */
export async function takeHelpScreenshot(page, filename) {
  const outPath = path.join(imagesDir, filename);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`  📸 Saved ${filename}`);
}
