import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockState = {
  event_types: [],
  events: [],
  event_calendar: [],
  event_signups: [],
  members: [
    { _id: 'member-1', firstName: 'Ada', lastName: 'One', email: 'ada@example.com' },
    { _id: 'member-2', firstName: 'Ben', lastName: 'Two', email: 'ben@example.com' }
  ],
  counters: {
    event_types: 1,
    events: 1,
    event_calendar: 1,
    event_signups: 1
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function matchesQuery(doc, query = {}) {
  return Object.entries(query).every(([key, value]) => {
    if (value && typeof value === 'object' && '$in' in value) {
      const docValue = doc[key];
      if (Array.isArray(docValue)) {
        return docValue.some(item => value.$in.includes(item));
      }
      return value.$in.includes(docValue);
    }
    return doc[key] === value;
  });
}

vi.mock('../src/util/helpers.js', () => ({
  safeCollectionFind: vi.fn(async (collectionName, query = {}) => {
    const docs = mockState[collectionName] || [];
    return clone(docs.filter(doc => matchesQuery(doc, query)));
  }),
  safeCollectionFindOne: vi.fn(async (collectionName, query = {}) => {
    const docs = mockState[collectionName] || [];
    const match = docs.find(doc => matchesQuery(doc, query));
    return match ? clone(match) : null;
  }),
  safeCollectionInsert: vi.fn(async (collectionName, data) => {
    const nextId = `${collectionName}-${mockState.counters[collectionName] || 1}`;
    mockState.counters[collectionName] = (mockState.counters[collectionName] || 1) + 1;
    const inserted = { _id: nextId, ...clone(data) };
    if (!mockState[collectionName]) {
      mockState[collectionName] = [];
    }
    mockState[collectionName].push(inserted);
    return { insertedId: nextId };
  }),
  safeCollectionUpdate: vi.fn(async (collectionName, query, update) => {
    const docs = mockState[collectionName] || [];
    const index = docs.findIndex(doc => matchesQuery(doc, query));
    if (index === -1) {
      return { matchedCount: 0, modifiedCount: 0 };
    }
    const nextDoc = {
      ...docs[index],
      ...(update.$set || {})
    };
    docs[index] = nextDoc;
    return { matchedCount: 1, modifiedCount: 1 };
  })
}));

describe('events API routes', () => {
  beforeEach(() => {
    mockState.event_types = [
      {
        _id: 'event_types-1',
        eventType: 'service-a',
        title: 'Service A',
        allowedRoles: ['deacon', 'staff', 'elder', 'helper'],
        assignmentRoles: ['deacon', 'staff'],
        scheduleDependencies: [
          { eventType: 'service-leadership', offsetMinutes: -30, uniquePer: 'day' },
          { eventType: 'service-setup', offsetMinutes: -60, uniquePer: 'day' },
          { eventType: 'service-cleanup', offsetMinutes: 60, uniquePer: 'slot' }
        ],
        defaultPositions: [
          { positionId: 'P1', label: 'Position 1', priority: 1, isCritical: true },
          { positionId: 'P2', label: 'Position 2', priority: 2, isCritical: false }
        ],
        isActive: true
      },
      {
        _id: 'event_types-2',
        eventType: 'service-leadership',
        title: 'Service Leadership',
        allowedRoles: ['deacon', 'staff', 'elder', 'helper'],
        assignmentRoles: ['deacon', 'staff'],
        defaultPositions: [
          { positionId: 'LEADER', label: 'Event Leader', priority: 1, isCritical: true, allowSelfSignup: false },
          { positionId: 'ASSIST', label: 'Event Assistant', priority: 2, isCritical: false }
        ],
        isSchedulable: false,
        isActive: true
      },
      {
        _id: 'event_types-3',
        eventType: 'service-setup',
        title: 'Service Setup',
        allowedRoles: ['deacon', 'staff', 'elder', 'helper'],
        assignmentRoles: ['deacon', 'staff'],
        defaultPositions: [
          { positionId: 'S1', label: 'Setup 1', priority: 1, isCritical: true }
        ],
        isSchedulable: false,
        isActive: true
      },
      {
        _id: 'event_types-4',
        eventType: 'service-cleanup',
        title: 'Service Cleanup',
        allowedRoles: ['deacon', 'staff', 'elder', 'helper'],
        assignmentRoles: ['deacon', 'staff'],
        defaultPositions: [
          { positionId: 'C1', label: 'Cleanup 1', priority: 1, isCritical: true }
        ],
        isSchedulable: false,
        isActive: true
      }
    ];
    mockState.events = [];
    mockState.event_calendar = [];
    mockState.event_signups = [];
    mockState.counters.event_types = 5;
    mockState.counters.events = 1;
    mockState.counters.event_calendar = 1;
    mockState.counters.event_signups = 1;
    process.env.GENERATION_API_KEY = 'test-generation-key';
  });

  test('GET /api/events returns all allowed event types when no filter is provided', async () => {
    const { createApp } = await import('../src/api.js');
    const app = createApp();

    const response = await app.request('/api/events', {
      headers: { 'x-api-key': 'test-generation-key' }
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(0);
  });

  test('POST /api/events creates a typed event from DB config', async () => {
    const { createApp } = await import('../src/api.js');
    const app = createApp();

    const response = await app.request('/api/events', {
      method: 'POST',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventType: 'service-a',
        serviceDate: '2026-06-07',
        serviceTime: '08:30'
      })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.event.eventType).toBe('service-a');
    expect(body.event.neededCount).toBe(2);
    expect(mockState.events).toHaveLength(4);
    expect(body.autoScheduledCount).toBe(3);
    expect(mockState.event_calendar).toHaveLength(4);
  });

  test('GET /api/events/types returns schedulable event types for role', async () => {
    const { createApp } = await import('../src/api.js');
    const app = createApp();

    const response = await app.request('/api/events/types', {
      headers: { 'x-api-key': 'test-generation-key' }
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.eventTypes.some(type => type.eventType === 'service-a')).toBe(true);
  });

  test('POST /api/events supports multiple service times and auto-schedules dependencies', async () => {
    const { createApp } = await import('../src/api.js');
    const app = createApp();

    const response = await app.request('/api/events', {
      method: 'POST',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventType: 'service-a',
        serviceDate: '2026-06-07',
        serviceTimes: ['08:30', '10:00']
      })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(2);
    expect(body.autoScheduledCount).toBe(4);
    expect(body.autoScheduledEvents.some(event => event.title.includes('Service Leadership'))).toBe(true);
    expect(body.autoScheduledEvents.some(event => event.title.includes('Service Setup'))).toBe(true);
    expect(mockState.event_calendar.filter(event => event.eventType === 'service-a')).toHaveLength(2);
    expect(mockState.event_calendar.filter(event => event.eventType === 'service-leadership')).toHaveLength(1);
    expect(mockState.event_calendar.filter(event => event.eventType === 'service-setup')).toHaveLength(1);
    expect(mockState.event_calendar.filter(event => event.eventType === 'service-cleanup')).toHaveLength(2);
    const leadershipLeaderSignup = mockState.event_signups.find(signup => signup.eventType === 'service-leadership' && signup.positionId === 'LEADER');
    expect(leadershipLeaderSignup).toBeDefined();
    expect(leadershipLeaderSignup.memberId).toBe('script-generator');
  });

  test('POST /api/events/:id/signups rejects self-signup into locked leader position', async () => {
    const { createApp } = await import('../src/api.js');
    const app = createApp();

    const createResponse = await app.request('/api/events', {
      method: 'POST',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventType: 'service-a',
        serviceDate: '2026-06-07',
        serviceTime: '08:30'
      })
    });

    const created = await createResponse.json();
    const leadershipAuto = (created.autoScheduledEvents || []).find(event => event.eventType === 'service-leadership');
    expect(leadershipAuto).toBeDefined();

    const signupResponse = await app.request(`/api/events/${leadershipAuto._id}/signups`, {
      method: 'POST',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ memberId: 'member-1', positionId: 'LEADER', isAvailable: true })
    });

    expect(signupResponse.status).toBe(400);
    const body = await signupResponse.json();
    expect(body.message).toContain('assigned by event leadership');
  });

  test('POST /api/events rejects duplicate typed event for same service slot', async () => {
    const { createApp } = await import('../src/api.js');
    const app = createApp();
    const payload = {
      eventType: 'service-a',
      serviceDate: '2026-06-07',
      serviceTime: '08:30'
    };

    await app.request('/api/events', {
      method: 'POST',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const duplicateResponse = await app.request('/api/events', {
      method: 'POST',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    expect(duplicateResponse.status).toBe(400);
    const body = await duplicateResponse.json();
    expect(body.message).toContain('already exists');
  });

  test('POST /api/events/:id/signups updates assignments through generic route', async () => {
    const { createApp } = await import('../src/api.js');
    const app = createApp();

    const createResponse = await app.request('/api/events', {
      method: 'POST',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventType: 'service-a',
        serviceDate: '2026-06-07',
        serviceTime: '08:30'
      })
    });

    const created = await createResponse.json();
    const eventId = created.id;

    const signupResponse = await app.request(`/api/events/${eventId}/signups`, {
      method: 'POST',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ memberId: 'member-1', isAvailable: true })
    });

    expect(signupResponse.status).toBe(200);
    const body = await signupResponse.json();
    expect(body.event.status.color).toBe('yellow');
    expect(body.event.positions[0].assignedMemberId).toBe('member-1');
    const serviceASignups = mockState.event_signups.filter(signup => signup.eventType === 'service-a');
    expect(serviceASignups).toHaveLength(1);
    expect(serviceASignups[0].assignedPositionId).toBe('P1');
  });
});
