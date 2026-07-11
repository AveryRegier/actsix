import { test, expect } from 'vitest';
import {
  normalizeEventPositions,
  deriveEventStatusFromPositions,
  normalizeEventBody,
  getEventTypeConfig
} from '../src/api/events.js';

const TEST_EVENT_TYPE_CONFIG_MAP = {
  'service-a': {
    eventType: 'service-a',
    title: 'Service A',
    allowedRoles: ['deacon', 'staff', 'elder', 'helper'],
    assignmentRoles: ['deacon', 'staff'],
    defaultPositions: [
      { positionId: 'P1', label: 'Position 1', priority: 1, isCritical: true },
      { positionId: 'P2', label: 'Position 2', priority: 2, isCritical: true },
      { positionId: 'P3', label: 'Position 3', priority: 3, isCritical: false },
      { positionId: 'P4', label: 'Position 4', priority: 4, isCritical: false }
    ]
  }
};

function createServiceATestPositions() {
  return [
    { positionId: 'P1', label: 'Position 1', priority: 1, isCritical: true, assignedMemberId: null },
    { positionId: 'P2', label: 'Position 2', priority: 2, isCritical: true, assignedMemberId: null },
    { positionId: 'P3', label: 'Position 3', priority: 3, isCritical: false, assignedMemberId: null },
    { positionId: 'P4', label: 'Position 4', priority: 4, isCritical: false, assignedMemberId: null }
  ];
}

test('event type config map exposes expected role controls', () => {
  const config = getEventTypeConfig('service-a', TEST_EVENT_TYPE_CONFIG_MAP);
  expect(config.allowedRoles).toEqual(['deacon', 'staff', 'elder', 'helper']);
  expect(config.assignmentRoles).toEqual(['deacon', 'staff']);
});

test('event type fixture has expected position counts', () => {
  const positions = createServiceATestPositions();
  expect(positions).toHaveLength(4);
  expect(positions.filter(position => position.isCritical)).toHaveLength(2);
});

test('event type gets default title and positions from config map', () => {
  const normalized = normalizeEventBody({
    eventType: 'service-a',
    serviceDate: '2026-06-07',
    serviceTime: '08:30'
  }, TEST_EVENT_TYPE_CONFIG_MAP);

  expect(normalized.data.title).toContain('Service A');
  expect(normalized.data.positions).toHaveLength(4);
});

test('critical fill remains red until all critical positions are filled', () => {
  const positions = normalizeEventPositions(createServiceATestPositions().map((position, index) => ({
    ...position,
    assignedMemberId: index < 1 ? `member-${index}` : null
  })));

  const status = deriveEventStatusFromPositions(positions);
  expect(status.color).toBe('red');
  expect(status.criticalFilledCount).toBe(1);
  expect(status.criticalTotal).toBe(2);
});
