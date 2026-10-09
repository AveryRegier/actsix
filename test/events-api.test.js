import { beforeEach, describe, expect, test, vi } from 'vitest';

const initialMembers = [
  { _id: 'member-1', firstName: 'Ada', lastName: 'One', email: 'ada@example.com', gender: 'male', tags: ['deacon'] },
  { _id: 'member-2', firstName: 'Ben', lastName: 'Two', email: 'ben@example.com', gender: 'female', tags: ['deacon'] }
];

const mockState = {
  event_types: [],
  events: [],
  event_calendar: [],
  event_signups: [],
  households: [],
  members: clone(initialMembers),
  counters: {
    event_types: 1,
    events: 1,
    event_calendar: 1,
    event_signups: 1,
    households: 1
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
    if (value && typeof value === 'object' && '$ne' in value) {
      return doc[key] !== value.$ne;
    }
    if (value && typeof value === 'object' && '$gte' in value) {
      return doc[key] >= value.$gte;
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
  safeCollectionCount: vi.fn(async (collectionName, query = {}) => {
    const docs = mockState[collectionName] || [];
    return docs.filter(doc => matchesQuery(doc, query)).length;
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
        assigneeRoles: ['deacon', 'elder', 'usher'],
        quickAddAssigneeRole: 'usher',
        requiredGender: 'male',
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
        assigneeRoles: ['deacon', 'elder', 'usher'],
        quickAddAssigneeRole: 'usher',
        requiredGender: 'male',
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
        assigneeRoles: ['deacon', 'elder', 'usher'],
        quickAddAssigneeRole: 'usher',
        requiredGender: 'male',
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
        assigneeRoles: ['deacon', 'elder', 'usher'],
        quickAddAssigneeRole: 'usher',
        requiredGender: 'male',
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
    mockState.households = [];
    mockState.members = clone(initialMembers);
    mockState.counters.event_types = 5;
    mockState.counters.events = 1;
    mockState.counters.event_calendar = 1;
    mockState.counters.event_signups = 1;
    mockState.counters.households = 1;
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

  test('POST /api/events/:id/assignment-candidates creates a member and household', async () => {
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

    const response = await app.request(`/api/events/${eventId}/assignment-candidates`, {
      method: 'POST',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fullName: 'New Usher',
        gender: 'female'
      })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.candidate.firstName).toBe('New');
    expect(body.candidate.lastName).toBe('Usher');
    expect(body.candidate.tags).toContain('usher');
    expect(body.candidate.gender).toBe('male');
    expect(body.candidate.householdId).toBeTruthy();
    expect(mockState.households).toHaveLength(1);
    expect(mockState.members.some(member => member.firstName === 'New' && member.lastName === 'Usher')).toBe(true);
  });

  test('GET /api/events/:id/assignments only returns candidates matching requiredGender', async () => {
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
    const response = await app.request(`/api/events/${created.id}/assignments`, {
      headers: { 'x-api-key': 'test-generation-key' }
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    const candidateIds = (body.assignmentCandidates || []).map(candidate => candidate._id);
    expect(candidateIds).toContain('member-1');
    expect(candidateIds).not.toContain('member-2');
    expect(body.requiredGender).toBe('male');
  });

  test('admin-tagged deacon can manage event assignments in event and date views', async () => {
    const { createApp } = await import('../src/api.js');
    const app = createApp();
    mockState.members.push({ _id: 'script-generator', tags: ['admin'] });

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

    const eventAssignmentsResponse = await app.request(`/api/events/${created.id}/assignments`, {
      headers: { 'x-api-key': 'test-generation-key' }
    });
    expect(eventAssignmentsResponse.status).toBe(200);
    expect((await eventAssignmentsResponse.json()).canManageAssignments).toBe(true);

    const dateAssignmentsResponse = await app.request('/api/event-assignments?serviceDate=2026-06-07', {
      headers: { 'x-api-key': 'test-generation-key' }
    });
    expect(dateAssignmentsResponse.status).toBe(200);
    expect((await dateAssignmentsResponse.json())[0].canManageAssignments).toBe(true);

    const saveResponse = await app.request(`/api/events/${created.id}/assignments`, {
      method: 'PUT',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ assignments: [{ positionId: 'P2', memberId: 'member-1' }] })
    });
    expect(saveResponse.status).toBe(200);
  });

  test('PUT /api/events/:id/cancel marks event cancelled and excludes it from upcoming member assignments', async () => {
    const { createApp } = await import('../src/api.js');
    const app = createApp();
    const futureDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    mockState.event_calendar.push(
      {
        _id: 'calendar-active',
        eventId: 'definition-active',
        eventType: 'service-a',
        serviceDate: futureDate,
        serviceTime: '08:30',
        neededCount: 2,
        criticalPositionIds: ['P1']
      },
      {
        _id: 'calendar-cancelled',
        eventId: 'definition-cancelled',
        eventType: 'service-a',
        serviceDate: futureDate,
        serviceTime: '10:30',
        neededCount: 2,
        criticalPositionIds: ['P1']
      }
    );
    mockState.event_signups.push({
      _id: 'signup-cancelled',
      calendarId: 'calendar-cancelled',
      memberId: 'script-generator',
      isAvailable: true,
      assignedPositionId: null
    });

    const deniedResponse = await app.request('/api/events/calendar-cancelled/cancel', {
      method: 'PUT',
      headers: { 'x-api-key': 'test-generation-key' }
    });
    expect(deniedResponse.status).toBe(403);

    mockState.members.push({ _id: 'script-generator', tags: ['admin'] });
    const cancelResponse = await app.request('/api/events/calendar-cancelled/cancel', {
      method: 'PUT',
      headers: { 'x-api-key': 'test-generation-key' }
    });

    expect(cancelResponse.status).toBe(200);
    const cancelBody = await cancelResponse.json();
    expect(cancelBody.event.isCancelled).toBe(true);
    expect(cancelBody.event.cancelledAt).toBeTruthy();
    expect(cancelBody.event.cancelledBy).toBe('script-generator');

    const assignmentsResponse = await app.request('/api/member/assignments', {
      headers: { 'x-api-key': 'test-generation-key' }
    });

    expect(assignmentsResponse.status).toBe(200);
    const assignments = await assignmentsResponse.json();
    expect(assignments.map(assignment => assignment.event._id)).toEqual(['calendar-active']);
  });

  test('PUT /api/events/:id/assignments keeps member on explicitly selected position', async () => {
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

    const assignResponse = await app.request(`/api/events/${eventId}/assignments`, {
      method: 'PUT',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assignments: [
          {
            positionId: 'P2',
            memberId: 'member-1'
          }
        ]
      })
    });

    expect(assignResponse.status).toBe(200);
    const body = await assignResponse.json();
    const p2 = (body.event.positions || []).find(position => position.positionId === 'P2');
    const p1 = (body.event.positions || []).find(position => position.positionId === 'P1');

    expect(p2?.assignedMember?._id).toBe('member-1');
    expect(p1?.assignedMember?._id).not.toBe('member-1');
  });

  test('PUT /api/events/:id/assignments clear keeps position open after reload', async () => {
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

    await app.request(`/api/events/${eventId}/assignments`, {
      method: 'PUT',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assignments: [
          {
            positionId: 'P2',
            memberId: 'member-1'
          }
        ]
      })
    });

    const clearResponse = await app.request(`/api/events/${eventId}/assignments`, {
      method: 'PUT',
      headers: {
        'x-api-key': 'test-generation-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assignments: [
          {
            positionId: 'P2',
            memberId: null
          }
        ]
      })
    });
    expect(clearResponse.status).toBe(200);

    const reloadResponse = await app.request(`/api/events/${eventId}/assignments`, {
      headers: { 'x-api-key': 'test-generation-key' }
    });
    expect(reloadResponse.status).toBe(200);

    const body = await reloadResponse.json();
    const p2 = (body.event.positions || []).find(position => position.positionId === 'P2');
    expect(p2?.assignedMember).toBeNull();
    expect((body.event.positions || []).some(position => position.assignedMember?._id === 'member-1')).toBe(false);
  });
});
