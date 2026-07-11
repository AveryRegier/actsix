import { test, expect } from 'vitest';
import {
  normalizeEventPositions,
  deriveEventStatusFromPositions,
  assignPositions,
  normalizeEventBody,
  getEventTypeConfig
} from '../src/api/events.js';

const TEST_EVENT_TYPE_CONFIG_MAP = {
  'service-a': {
    eventType: 'service-a',
    title: 'Service A',
    allowedRoles: ['deacon', 'staff'],
    assignmentRoles: ['deacon', 'staff'],
    defaultPositions: [
      { positionId: 'P1', label: 'Position 1', priority: 1, isCritical: true },
      { positionId: 'P2', label: 'Position 2', priority: 2, isCritical: false }
    ]
  }
};

test('generic event body requires supported event type', () => {
  expect(normalizeEventBody({ serviceDate: '2026-06-07', serviceTime: '08:30', positions: [] }).error).toContain('eventType');
  expect(normalizeEventBody({ eventType: 'unknown', serviceDate: '2026-06-07', serviceTime: '08:30', positions: [{}] }, TEST_EVENT_TYPE_CONFIG_MAP).error).toContain('Unsupported eventType');
});

test('generic event body normalizes supported typed event', () => {
  const normalized = normalizeEventBody({
    eventType: 'service-a',
    serviceDate: '2026-06-07',
    serviceTime: '08:30'
  }, TEST_EVENT_TYPE_CONFIG_MAP);

  expect(normalized.error).toBeUndefined();
  expect(normalized.data.eventType).toBe('service-a');
  expect(normalized.data.neededCount).toBeGreaterThan(0);
  expect(normalized.data.positions[0].positionId).toBe('P1');
});

test('generic event status derives red/yellow/green from critical and total fill', () => {
  const red = deriveEventStatusFromPositions([
    { positionId: 'A', label: 'A', priority: 1, isCritical: true, assignedMemberId: null },
    { positionId: 'B', label: 'B', priority: 2, isCritical: false, assignedMemberId: 'm2' }
  ]);
  const yellow = deriveEventStatusFromPositions([
    { positionId: 'A', label: 'A', priority: 1, isCritical: true, assignedMemberId: 'm1' },
    { positionId: 'B', label: 'B', priority: 2, isCritical: false, assignedMemberId: null }
  ]);
  const green = deriveEventStatusFromPositions([
    { positionId: 'A', label: 'A', priority: 1, isCritical: true, assignedMemberId: 'm1' },
    { positionId: 'B', label: 'B', priority: 2, isCritical: false, assignedMemberId: 'm2' }
  ]);

  expect(red.color).toBe('red');
  expect(yellow.color).toBe('yellow');
  expect(green.color).toBe('green');
});

test('generic assignment uses priority order and signup order', () => {
  const result = assignPositions([
    { memberId: 'm2', isAvailable: true, createdAt: '2026-06-07T10:00:00.000Z' },
    { memberId: 'm1', isAvailable: true, createdAt: '2026-06-07T09:00:00.000Z' }
  ], normalizeEventPositions([
    { positionId: 'P1', label: 'P1', priority: 1, isCritical: true },
    { positionId: 'P2', label: 'P2', priority: 2, isCritical: false }
  ]));

  expect(result.positions[0].assignedMemberId).toBe('m1');
  expect(result.positions[1].assignedMemberId).toBe('m2');
});

test('generic config resolves configured event type', () => {
  const config = getEventTypeConfig('service-a', TEST_EVENT_TYPE_CONFIG_MAP);
  expect(config.title).toBe('Service A');
  expect(config.allowedRoles).toContain('deacon');
});