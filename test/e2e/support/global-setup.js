import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { resetMailbox } from '../../harness/fake-mailbox.js';

function loadEnvFileIfPresent() {
  const envPath = path.join(process.cwd(), '.env.e2e');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }

    const idx = line.indexOf('=');
    if (idx < 1) {
      continue;
    }

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export default async function globalSetup() {
  loadEnvFileIfPresent();

  fs.mkdirSync(path.join(process.cwd(), '.coverage', 'e2e-browser', 'raw'), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'test-results'), { recursive: true });
  resetMailbox();
  await seedSummarySortData();
}

// Seeds role members and assigned households so specs can verify contact-summary role defaults and sorting.
async function seedSummarySortData() {
  const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${Number(process.env.E2E_PORT || 3101)}`;
  const post = async (route, data) => {
    const res = await fetch(baseURL + route, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.GENERATION_API_KEY || 'test-generation-key' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`seed ${route} failed: ${res.status}`);
    return res.json();
  };
  const addMember = async (lastName, tags) => {
    const household = await post('/api/households', { lastName });
    const email = `${lastName.toLowerCase()}@example.test`;
    const member = await post('/api/members', {
      householdId: household.id, firstName: 'Seed', lastName, relationship: 'head', gender: 'male', email, phone: '515-555-0600', tags,
    });
    return { memberId: member.id, householdId: household.id, email };
  };

  const deacon = await addMember('SortDeacon', ['deacon']);
  const staff = await addMember('SortStaff', ['staff']);
  const helper = await addMember('SortHelper', ['helper']);

  const dayMs = 24 * 60 * 60 * 1000;
  // Name order differs from newest-contact order; SortNever has no contact.
  const targets = [
    { lastName: 'SortAlpha', daysAgo: 10, assignees: [deacon] },
    { lastName: 'SortMid', daysAgo: 5, assignees: [helper] },
    { lastName: 'SortNever', daysAgo: null, assignees: [deacon, helper] },
    { lastName: 'SortZeta', daysAgo: 1, assignees: [deacon, helper] },
  ];
  for (const t of targets) {
    const target = await addMember(t.lastName, ['member', 'shut-in']);
    await post(`/api/households/${target.householdId}/assignments`, { deaconIds: t.assignees.map(a => a.memberId) });
    if (t.daysAgo !== null) {
      await post('/api/contacts', {
        memberId: [target.memberId],
        deaconId: [deacon.memberId],
        contactType: 'phone',
        summary: `Seeded contact ${t.lastName}`,
        contactDate: new Date(Date.now() - t.daysAgo * dayMs).toISOString(),
      });
    }
  }

  const cancelEvents = await seedCancellableEvents(post, staff);

  fs.writeFileSync(
    path.join(process.cwd(), 'test-results', 'e2e-summary-seed.json'),
    JSON.stringify({ deacon, staff, helper, cancelEvents }),
  );
}

function nextSundayIso() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? 7 : 7 - day));
  return date.toISOString().split('T')[0];
}

// Seeds one event type and separate events for each cancellation spec, since cancelling mutates the event.
async function seedCancellableEvents(post, staff) {
  const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${Number(process.env.E2E_PORT || 3101)}`;
  const token = jwt.sign(
    { id: staff.memberId, email: staff.email, role: 'staff' },
    process.env.JWT_SECRET || 'actsix-e2e-secret',
    { expiresIn: '1h' },
  );
  const staffPost = async (route, data) => {
    const res = await fetch(baseURL + route, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`seed ${route} failed: ${res.status}`);
    return res.json();
  };

  const positions = [{ positionId: '4-FC', label: 'Aisle 4 Front Center', priority: 1, isCritical: true }];
  // A schedulable parent type plus a non-schedulable dependent (like Lord's Supper + Setup) that must cancel together.
  const seedGroup = async (eventType, title, serviceDate) => {
    await staffPost('/api/events/types', {
      eventType: `${eventType}-setup`,
      title: `${title} Setup`,
      allowedRoles: ['deacon', 'staff'],
      assignmentRoles: ['deacon', 'staff'],
      defaultPositions: positions,
      isSchedulable: false,
      isActive: true,
    });
    await staffPost('/api/events/types', {
      eventType,
      title,
      allowedRoles: ['deacon', 'staff'],
      assignmentRoles: ['deacon', 'staff'],
      defaultPositions: positions,
      scheduleDependencies: [{ eventType: `${eventType}-setup`, offsetMinutes: -60, uniquePer: 'slot' }],
      isActive: true,
    });
    const created = await staffPost('/api/events', { eventType, serviceDate, serviceTime: '09:00' });
    return { title, serviceDate, eventId: created.id };
  };

  const sunday = nextSundayIso();
  const followingSunday = new Date(`${sunday}T12:00:00Z`);
  followingSunday.setUTCDate(followingSunday.getUTCDate() + 7);

  return {
    denied: await seedGroup('e2e-cancel-view', 'E2E Cancel View', sunday),
    flow: await seedGroup('e2e-cancel-flow', 'E2E Cancel Flow', followingSunday.toISOString().split('T')[0]),
  };
}