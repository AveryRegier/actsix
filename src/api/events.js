import { getLogger } from '../util/logger.js';
import { safeCollectionFind, safeCollectionFindOne, safeCollectionInsert, safeCollectionUpdate } from '../util/helpers.js';
import { verifyRole } from '../auth/auth.js';

const DEFAULT_EVENT_TYPE_DOCS = [];

function toStringOrNull(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') {
      return true;
    }
    if (lowered === 'false') {
      return false;
    }
  }

  return Boolean(value);
}

function normalizePriority(value, fallback) {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber;
  }
  return fallback;
}

function normalizeOffsetMinutes(value) {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return Math.trunc(asNumber);
  }
  return 0;
}

function normalizeRoleList(roles, fallback = []) {
  if (!Array.isArray(roles)) {
    return fallback;
  }

  const values = Array.from(new Set(roles.map(role => toStringOrNull(role)).filter(Boolean)));
  return values.length > 0 ? values : fallback;
}

function normalizeDependencyScope(value) {
  const scope = toStringOrNull(value);
  if (!scope) {
    return 'slot';
  }

  return scope === 'day' ? 'day' : 'slot';
}

function normalizeScheduleDependencies(dependencies, fallback = []) {
  const source = Array.isArray(dependencies) ? dependencies : fallback;
  const normalized = [];

  for (const dependency of source) {
    const eventType = toStringOrNull(dependency?.eventType);
    if (!eventType) {
      continue;
    }

    normalized.push({
      eventType,
      offsetMinutes: normalizeOffsetMinutes(dependency?.offsetMinutes),
      uniquePer: normalizeDependencyScope(dependency?.uniquePer)
    });
  }

  return normalized;
}

function formatDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${formatDatePart(date.getMonth() + 1)}-${formatDatePart(date.getDate())}`;
}

function formatLocalTime(date) {
  return `${formatDatePart(date.getHours())}:${formatDatePart(date.getMinutes())}`;
}

function applyMinuteOffset(serviceDate, serviceTime, offsetMinutes) {
  const base = new Date(`${serviceDate}T${serviceTime}:00`);
  if (Number.isNaN(base.getTime())) {
    return null;
  }

  base.setMinutes(base.getMinutes() + offsetMinutes);
  return {
    serviceDate: formatLocalDate(base),
    serviceTime: formatLocalTime(base)
  };
}

function normalizeServiceTimes(body) {
  const source = Array.isArray(body?.serviceTimes)
    ? body.serviceTimes
    : [body?.serviceTime];

  const seen = new Set();
  const normalized = [];
  const timePattern = /^\d{2}:\d{2}$/;

  for (const value of source) {
    const time = toStringOrNull(value);
    if (!time || !timePattern.test(time)) {
      continue;
    }
    if (seen.has(time)) {
      continue;
    }

    seen.add(time);
    normalized.push(time);
  }

  normalized.sort();
  return normalized;
}

export function normalizeEventPositions(positions) {
  const sourcePositions = Array.isArray(positions) ? positions : [];

  const normalized = sourcePositions
    .map((position, index) => {
      const positionId = toStringOrNull(position.positionId) || `P${index + 1}`;
      const label = toStringOrNull(position.label) || `Position ${index + 1}`;

      return {
        positionId,
        label,
        priority: normalizePriority(position.priority, index + 1),
        isCritical: normalizeBoolean(position.isCritical, false),
        allowSelfSignup: normalizeBoolean(position.allowSelfSignup, true),
        assignedMemberId: toStringOrNull(position.assignedMemberId)
      };
    })
    .filter(position => position.positionId !== null);

  normalized.sort((a, b) => a.priority - b.priority);
  return normalized;
}

function normalizeDefinitionPositions(positions) {
  return normalizeEventPositions(positions).map(position => ({
    positionId: position.positionId,
    label: position.label,
    priority: position.priority,
    isCritical: position.isCritical,
    allowSelfSignup: position.allowSelfSignup,
    assignedMemberId: null
  }));
}

function normalizeEventTypeDocument(doc) {
  const eventType = toStringOrNull(doc?.eventType);
  if (!eventType) {
    return null;
  }

  const defaultSeed = DEFAULT_EVENT_TYPE_DOCS.find(seed => seed.eventType === eventType);
  const fallbackAllowed = defaultSeed?.allowedRoles || [];
  const fallbackAssignment = defaultSeed?.assignmentRoles || [];
  const fallbackAssigneeRoles = defaultSeed?.assigneeRoles || [];
  const fallbackPositions = defaultSeed?.defaultPositions || [];
  const fallbackDependencies = defaultSeed?.scheduleDependencies || [];

  const defaultPositions = normalizeDefinitionPositions(
    Array.isArray(doc?.defaultPositions) && doc.defaultPositions.length > 0
      ? doc.defaultPositions
      : fallbackPositions
  );

  return {
    eventType,
    title: toStringOrNull(doc?.title) || defaultSeed?.title || 'Event',
    allowedRoles: normalizeRoleList(doc?.allowedRoles, fallbackAllowed),
    assignmentRoles: normalizeRoleList(doc?.assignmentRoles, fallbackAssignment),
    assigneeRoles: normalizeRoleList(doc?.assigneeRoles, fallbackAssigneeRoles),
    defaultPositions,
    scheduleDependencies: normalizeScheduleDependencies(doc?.scheduleDependencies, fallbackDependencies),
    isActive: doc?.isActive !== false,
    isSchedulable: doc?.isSchedulable !== false
  };
}

function getDefaultEventTypeConfigMap() {
  const map = {};
  for (const doc of DEFAULT_EVENT_TYPE_DOCS) {
    const normalized = normalizeEventTypeDocument(doc);
    if (normalized) {
      map[normalized.eventType] = normalized;
    }
  }
  return map;
}

async function ensureEventTypeSeedData() {
  return;
}

async function getEventTypeConfigMapFromDb() {
  await ensureEventTypeSeedData();
  const docs = await safeCollectionFind('event_types', { isActive: true });
  const map = {};
  for (const doc of docs) {
    const normalized = normalizeEventTypeDocument(doc);
    if (!normalized) {
      continue;
    }
    map[normalized.eventType] = normalized;
  }
  return map;
}

export function deriveEventStatusFromPositions(positions) {
  const normalizedPositions = normalizeEventPositions(positions);
  const totalPositions = normalizedPositions.length;
  const criticalPositions = normalizedPositions.filter(position => position.isCritical);

  const filledCount = normalizedPositions.filter(position => position.assignedMemberId).length;
  const criticalFilledCount = criticalPositions.filter(position => position.assignedMemberId).length;
  const criticalTotal = criticalPositions.length;

  let color = 'green';
  if (criticalFilledCount < criticalTotal) {
    color = 'red';
  } else if (filledCount < totalPositions) {
    color = 'yellow';
  }

  return {
    color,
    totalPositions,
    filledCount,
    openCount: totalPositions - filledCount,
    criticalTotal,
    criticalFilledCount,
    criticalOpenCount: criticalTotal - criticalFilledCount,
    allCriticalFilled: criticalFilledCount === criticalTotal,
    allFilled: filledCount === totalPositions
  };
}

export function assignPositions(signups, positions) {
  const normalizedPositions = normalizeEventPositions(positions);
  const availableSignups = (Array.isArray(signups) ? signups : [])
    .filter(signup => signup && signup.isAvailable && signup.memberId)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  const positionIds = new Set(normalizedPositions.map(position => position.positionId));
  const assignedByPosition = new Map();
  const assignedByMember = new Map();

  for (const signup of availableSignups) {
    const preferredPositionId = toStringOrNull(signup.positionId);
    if (!preferredPositionId || !positionIds.has(preferredPositionId)) {
      continue;
    }

    if (assignedByPosition.has(preferredPositionId) || assignedByMember.has(signup.memberId)) {
      continue;
    }

    assignedByPosition.set(preferredPositionId, signup.memberId);
    assignedByMember.set(signup.memberId, preferredPositionId);
  }

  for (const position of normalizedPositions) {
    if (position.allowSelfSignup === false) {
      continue;
    }

    if (assignedByPosition.has(position.positionId)) {
      continue;
    }

    const nextSignup = availableSignups.find(signup => !assignedByMember.has(signup.memberId));
    if (!nextSignup) {
      continue;
    }

    assignedByPosition.set(position.positionId, nextSignup.memberId);
    assignedByMember.set(nextSignup.memberId, position.positionId);
  }

  const updatedPositions = normalizedPositions.map(position => ({
    ...position,
    assignedMemberId: assignedByPosition.get(position.positionId) || null
  }));

  const now = new Date().toISOString();
  const updatedSignups = availableSignups.map(signup => ({
    ...signup,
    assignedPositionId: assignedByMember.get(signup.memberId) || null,
    updatedAt: now
  }));

  return {
    positions: updatedPositions,
    updatedSignups,
    status: deriveEventStatusFromPositions(updatedPositions)
  };
}

export function getEventTypeConfig(eventType, eventTypeConfigMap = null) {
  const source = eventTypeConfigMap || getDefaultEventTypeConfigMap();
  return eventType ? source[eventType] || null : null;
}

function buildDefaultTitle(eventType, serviceDate, serviceTime, eventTypeConfigMap = null) {
  const config = getEventTypeConfig(eventType, eventTypeConfigMap);
  const typeTitle = config?.title || 'Event';
  return `${serviceDate} ${serviceTime} ${typeTitle}`;
}

function buildCalendarKey(eventId, serviceDate, serviceTime) {
  return `${eventId}:${serviceDate} ${serviceTime}`;
}

function getDefaultPositionsForType(eventType, eventTypeConfigMap = null) {
  const config = getEventTypeConfig(eventType, eventTypeConfigMap);
  if (!config || !Array.isArray(config.defaultPositions)) {
    return [];
  }

  return normalizeDefinitionPositions(config.defaultPositions);
}

export function normalizeEventBody(body, eventTypeConfigMap = null) {
  const eventType = toStringOrNull(body.eventType);
  const serviceDate = toStringOrNull(body.serviceDate);
  const serviceTime = toStringOrNull(body.serviceTime);

  if (!eventType) {
    return { error: 'Missing required field: eventType is required' };
  }

  if (!getEventTypeConfig(eventType, eventTypeConfigMap)) {
    return { error: `Unsupported eventType: ${eventType}` };
  }

  if (!serviceDate || !serviceTime) {
    return { error: 'Missing required fields: serviceDate and serviceTime are required' };
  }

  const parsedDate = new Date(`${serviceDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return { error: 'Invalid serviceDate. Expected YYYY-MM-DD format' };
  }

  const sourcePositions = Array.isArray(body.positions) && body.positions.length > 0
    ? body.positions
    : getDefaultPositionsForType(eventType, eventTypeConfigMap);

  const positions = normalizeDefinitionPositions(sourcePositions);
  if (positions.length === 0) {
    return { error: `No positions configured for eventType: ${eventType}` };
  }

  const title = toStringOrNull(body.title) || buildDefaultTitle(eventType, serviceDate, serviceTime, eventTypeConfigMap);
  const eventSubtype = toStringOrNull(body.eventSubtype);

  return {
    data: {
      eventType,
      eventSubtype,
      title,
      serviceDate,
      serviceTime,
      positions,
      criticalPositionIds: positions.filter(position => position.isCritical).map(position => position.positionId),
      neededCount: positions.length,
      status: deriveEventStatusFromPositions(positions),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

async function createCalendarSlot({
  eventDefinition,
  serviceDate,
  serviceTime,
  title = null,
  createdBy = null,
  failOnDuplicate = true
}) {
  const calendarKey = buildCalendarKey(eventDefinition._id, serviceDate, serviceTime);
  const duplicate = await safeCollectionFindOne('event_calendar', { calendarKey });
  if (duplicate) {
    if (failOnDuplicate) {
      return {
        error: 'An event already exists for this date and service time'
      };
    }

    return {
      skipped: true,
      calendarSlot: duplicate
    };
  }

  const now = new Date().toISOString();
  const fallbackTitle = toStringOrNull(eventDefinition?.title);
  const createdCalendar = {
    calendarKey,
    eventId: eventDefinition._id,
    eventType: eventDefinition.eventType,
    serviceDate,
    serviceTime,
    title: toStringOrNull(title) || fallbackTitle || buildDefaultTitle(eventDefinition.eventType, serviceDate, serviceTime),
    status: deriveEventStatusFromPositions(eventDefinition.positions),
    neededCount: eventDefinition.positions.length,
    criticalPositionIds: eventDefinition.positions.filter(position => position.isCritical).map(position => position.positionId),
    createdBy,
    createdAt: now,
    updatedAt: now
  };

  const result = await safeCollectionInsert('event_calendar', createdCalendar);
  const calendarId = result.insertedId?.toString();

  const normalizedPositions = normalizeDefinitionPositions(eventDefinition.positions || []);
  const lockedPosition = normalizedPositions
    .filter(position => position.allowSelfSignup === false)
    .sort((a, b) => a.priority - b.priority)[0] || null;

  if (calendarId && createdBy && lockedPosition) {
    const existingCreatorSignup = await safeCollectionFindOne('event_signups', { calendarId, memberId: createdBy });
    const nowForSignup = new Date().toISOString();

    if (existingCreatorSignup) {
      await safeCollectionUpdate(
        'event_signups',
        { _id: existingCreatorSignup._id },
        {
          $set: {
            calendarId,
            eventId: eventDefinition._id,
            eventType: eventDefinition.eventType,
            memberId: createdBy,
            positionId: lockedPosition.positionId,
            isAvailable: true,
            unavailableReason: null,
            assignedPositionId: lockedPosition.positionId,
            updatedAt: nowForSignup
          }
        }
      );
    } else {
      await safeCollectionInsert('event_signups', {
        calendarId,
        eventId: eventDefinition._id,
        eventType: eventDefinition.eventType,
        memberId: createdBy,
        positionId: lockedPosition.positionId,
        isAvailable: true,
        unavailableReason: null,
        assignedPositionId: lockedPosition.positionId,
        createdAt: nowForSignup,
        updatedAt: nowForSignup
      });
    }
  }

  return {
    skipped: false,
    calendarSlot: {
      _id: calendarId,
      ...createdCalendar
    }
  };
}

async function autoScheduleDependencies({
  parentCalendarSlot,
  parentEventConfig,
  eventTypeConfigMap,
  createdBy
}) {
  const dependencies = Array.isArray(parentEventConfig?.scheduleDependencies)
    ? parentEventConfig.scheduleDependencies
    : [];

  if (dependencies.length === 0) {
    return [];
  }

  const created = [];

  for (const dependency of dependencies) {
    const targetConfig = getEventTypeConfig(dependency.eventType, eventTypeConfigMap);
    if (!targetConfig) {
      continue;
    }

    const shifted = applyMinuteOffset(
      parentCalendarSlot.serviceDate,
      parentCalendarSlot.serviceTime,
      dependency.offsetMinutes || 0
    );
    if (!shifted) {
      continue;
    }

    if (dependency.uniquePer === 'day') {
      const existingForDay = await safeCollectionFindOne('event_calendar', {
        eventType: dependency.eventType,
        serviceDate: shifted.serviceDate
      });
      if (existingForDay) {
        continue;
      }
    }

    const targetDefinition = await getOrCreateEventDefinition(
      dependency.eventType,
      null,
      eventTypeConfigMap
    );
    if (!targetDefinition || !targetDefinition._id) {
      continue;
    }

    const createdSlot = await createCalendarSlot({
      eventDefinition: targetDefinition,
      serviceDate: shifted.serviceDate,
      serviceTime: shifted.serviceTime,
      createdBy,
      failOnDuplicate: false
    });

    if (!createdSlot.skipped && createdSlot.calendarSlot) {
      created.push(buildCalendarView(createdSlot.calendarSlot, targetDefinition, []));
    }
  }

  return created;
}

async function getOrCreateEventDefinition(eventType, requestedPositions = null, eventTypeConfigMap = null) {
  const config = getEventTypeConfig(eventType, eventTypeConfigMap);
  if (!config) {
    return null;
  }

  const existing = await safeCollectionFindOne('events', { eventType });
  if (existing) {
    const normalizedExistingPositions = normalizeDefinitionPositions(existing.positions || getDefaultPositionsForType(eventType, eventTypeConfigMap));
    return {
      ...existing,
      title: toStringOrNull(existing.title) || config.title,
      positions: normalizedExistingPositions,
      neededCount: normalizedExistingPositions.length,
      criticalPositionIds: normalizedExistingPositions.filter(position => position.isCritical).map(position => position.positionId)
    };
  }

  const definitionPositions = normalizeDefinitionPositions(
    Array.isArray(requestedPositions) && requestedPositions.length > 0 ? requestedPositions : getDefaultPositionsForType(eventType, eventTypeConfigMap)
  );

  const now = new Date().toISOString();
  const definitionToCreate = {
    eventType,
    title: config.title,
    eventSubtype: null,
    positions: definitionPositions,
    neededCount: definitionPositions.length,
    criticalPositionIds: definitionPositions.filter(position => position.isCritical).map(position => position.positionId),
    createdAt: now,
    updatedAt: now
  };

  const inserted = await safeCollectionInsert('events', definitionToCreate);
  const insertedId = inserted.insertedId?.toString();

  if (insertedId) {
    const loaded = await safeCollectionFindOne('events', { _id: insertedId });
    if (loaded) {
      return {
        ...loaded,
        positions: normalizeDefinitionPositions(loaded.positions || definitionPositions)
      };
    }
  }

  return {
    _id: insertedId || null,
    ...definitionToCreate
  };
}

function canManageOtherSignups(role, eventType, eventTypeConfigMap = null) {
  const config = getEventTypeConfig(eventType, eventTypeConfigMap);
  return Boolean(config && config.assignmentRoles.includes(role));
}

function getAssigneeRolesForEventType(eventType, eventTypeConfigMap = null) {
  const config = getEventTypeConfig(eventType, eventTypeConfigMap);
  const configured = normalizeRoleList(config?.assigneeRoles);
  if (configured.length > 0) {
    return configured;
  }

  const fallback = normalizeRoleList(config?.allowedRoles);
  return fallback.length > 0 ? fallback : ['deacon', 'elder', 'usher'];
}

async function loadAssignmentCandidates(eventType, eventTypeConfigMap = null) {
  const assigneeRoles = getAssigneeRolesForEventType(eventType, eventTypeConfigMap);
  const members = await safeCollectionFind('members', { tags: { $in: assigneeRoles } });

  const unique = new Map();
  for (const member of members) {
    if (!member?._id) {
      continue;
    }
    if (Array.isArray(member.tags) && member.tags.includes('deceased')) {
      continue;
    }
    unique.set(member._id, {
      _id: member._id,
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      email: member.email || '',
      tags: Array.isArray(member.tags) ? member.tags : []
    });
  }

  const candidates = Array.from(unique.values()).sort((a, b) => {
    const lastCompare = (a.lastName || '').localeCompare(b.lastName || '', undefined, { sensitivity: 'base' });
    if (lastCompare !== 0) {
      return lastCompare;
    }
    return (a.firstName || '').localeCompare(b.firstName || '', undefined, { sensitivity: 'base' });
  });

  return {
    candidates,
    assigneeRoles
  };
}

function isLeadershipAssignmentPosition(position) {
  if (!position) {
    return false;
  }

  if (position.allowSelfSignup === false) {
    return true;
  }

  const positionId = String(position.positionId || '').toLowerCase();
  const label = String(position.label || '').toLowerCase();
  return positionId.includes('assist') || label.includes('assistant');
}

async function memberHasLeadershipAccessOnServiceDate(memberId, serviceDate, eventTypeConfigMap = null) {
  if (!memberId || !serviceDate) {
    return false;
  }

  const dateEvents = await safeCollectionFind('event_calendar', { serviceDate });
  for (const slot of dateEvents) {
    const loaded = await loadCalendarAndDefinition(slot._id, eventTypeConfigMap);
    if (!loaded) {
      continue;
    }

    const signups = await loadSignupsForCalendar(loaded.calendarSlot, loaded.eventDefinition);
    const assignment = assignPositions(signups, loaded.eventDefinition.positions || []);
    if (assignment.positions.some(position => isLeadershipAssignmentPosition(position) && position.assignedMemberId === memberId)) {
      return true;
    }
  }

  return false;
}

async function canManageAssignments(c, loaded, eventTypeConfigMap = null) {
  const role = toStringOrNull(c.req.role);
  if (role && ['staff', 'admin'].includes(role)) {
    return true;
  }

  const memberId = toStringOrNull(c.req.memberId);
  if (!memberId) {
    return false;
  }

  return memberHasLeadershipAccessOnServiceDate(memberId, loaded?.calendarSlot?.serviceDate, eventTypeConfigMap);
}

function buildCalendarView(calendarSlot, eventDefinition, signups) {
  const assignment = assignPositions(signups, eventDefinition.positions || []);
  const neededCount = assignment.positions.length;
  const criticalPositionIds = assignment.positions.filter(position => position.isCritical).map(position => position.positionId);

  return {
    _id: calendarSlot._id,
    calendarId: calendarSlot._id,
    eventId: eventDefinition._id,
    eventType: eventDefinition.eventType,
    eventSubtype: eventDefinition.eventSubtype || null,
    title: toStringOrNull(calendarSlot.title) || buildDefaultTitle(eventDefinition.eventType, calendarSlot.serviceDate, calendarSlot.serviceTime),
    serviceDate: calendarSlot.serviceDate,
    serviceTime: calendarSlot.serviceTime,
    positions: assignment.positions,
    neededCount,
    criticalPositionIds,
    status: assignment.status,
    createdAt: calendarSlot.createdAt,
    updatedAt: calendarSlot.updatedAt
  };
}

async function loadSignupsForCalendar(calendarSlot, eventDefinition) {
  const byCalendar = await safeCollectionFind('event_signups', { calendarId: calendarSlot._id });
  if (byCalendar.length > 0) {
    return byCalendar;
  }

  // Backward compatibility: older rows used eventId as the calendar slot id.
  const legacy = await safeCollectionFind('event_signups', { eventId: calendarSlot._id });
  if (legacy.length === 0) {
    return [];
  }

  for (const signup of legacy) {
    await safeCollectionUpdate(
      'event_signups',
      { _id: signup._id },
      {
        $set: {
          calendarId: calendarSlot._id,
          eventId: eventDefinition._id,
          eventType: eventDefinition.eventType,
          updatedAt: new Date().toISOString()
        }
      }
    );
  }

  return legacy.map(signup => ({
    ...signup,
    calendarId: calendarSlot._id,
    eventId: eventDefinition._id,
    eventType: eventDefinition.eventType
  }));
}

async function rebuildAssignmentsForCalendar(calendarSlot, eventDefinition) {
  const signups = await loadSignupsForCalendar(calendarSlot, eventDefinition);
  const assignment = assignPositions(signups, eventDefinition.positions || []);

  const now = new Date().toISOString();
  const neededCount = assignment.positions.length;
  const criticalPositionIds = assignment.positions.filter(position => position.isCritical).map(position => position.positionId);

  await safeCollectionUpdate(
    'event_calendar',
    { _id: calendarSlot._id },
    {
      $set: {
        status: assignment.status,
        neededCount,
        criticalPositionIds,
        updatedAt: now
      }
    }
  );

  for (const signup of signups) {
    const matched = assignment.updatedSignups.find(updatedSignup => updatedSignup._id === signup._id);
    await safeCollectionUpdate(
      'event_signups',
      { _id: signup._id },
      {
        $set: {
          calendarId: calendarSlot._id,
          eventId: eventDefinition._id,
          eventType: eventDefinition.eventType,
          assignedPositionId: matched?.assignedPositionId || null,
          updatedAt: now
        }
      }
    );
  }

  const updatedCalendar = {
    ...calendarSlot,
    status: assignment.status,
    neededCount,
    criticalPositionIds,
    updatedAt: now
  };

  return buildCalendarView(updatedCalendar, eventDefinition, signups);
}

async function loadCalendarAndDefinition(calendarId, eventTypeConfigMap = null) {
  const calendarSlot = await safeCollectionFindOne('event_calendar', { _id: calendarId });
  if (!calendarSlot) {
    return null;
  }

  let eventDefinition = null;
  const calendarEventId = toStringOrNull(calendarSlot.eventId);
  if (calendarEventId) {
    eventDefinition = await safeCollectionFindOne('events', { _id: calendarEventId });
  }

  if (!eventDefinition) {
    eventDefinition = await getOrCreateEventDefinition(calendarSlot.eventType, null, eventTypeConfigMap);
  }

  if (!eventDefinition) {
    return null;
  }

  return {
    calendarSlot,
    eventDefinition: {
      ...eventDefinition,
      positions: normalizeDefinitionPositions(eventDefinition.positions || getDefaultPositionsForType(eventDefinition.eventType, eventTypeConfigMap))
    }
  };
}

export default function registerEventRoutes(app) {
  app.post('/api/events/types', async (c) => {
    if (!verifyRole(c, ['staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }

    try {
      const body = await c.req.json();
      const normalized = normalizeEventTypeDocument(body);
      if (!normalized) {
        return c.json({ error: 'Validation failed', message: 'eventType is required' }, 400);
      }

      const existing = await safeCollectionFindOne('event_types', { eventType: normalized.eventType });
      const now = new Date().toISOString();
      if (existing) {
        await safeCollectionUpdate(
          'event_types',
          { _id: existing._id },
          { $set: { ...normalized, updatedAt: now } }
        );
      } else {
        await safeCollectionInsert('event_types', {
          ...normalized,
          createdAt: now,
          updatedAt: now
        });
      }

      return c.json({ message: 'Event type saved', eventType: normalized.eventType });
    } catch (error) {
      getLogger().error(error, 'Error saving event type:');
      return c.json({ error: 'Failed to save event type', message: error.message }, 500);
    }
  });

  app.get('/api/events/types', async (c) => {
    const role = c.req.role || null;
    const eventTypeConfigMap = await getEventTypeConfigMapFromDb();
    const eventTypes = Object.entries(eventTypeConfigMap)
      .filter(([, config]) => role && config.assignmentRoles.includes(role) && config.isSchedulable !== false)
      .map(([eventType, config]) => ({
        eventType,
        title: config.title,
        defaultPositionCount: Array.isArray(config.defaultPositions) ? config.defaultPositions.length : 0
      }));

    return c.json({ eventTypes, count: eventTypes.length });
  });

  app.get('/api/events', async (c) => {
    const eventTypeConfigMap = await getEventTypeConfigMapFromDb();
    const eventType = toStringOrNull(c.req.query('eventType'));
    const role = c.req.role || null;

    if (eventType) {
      const config = getEventTypeConfig(eventType, eventTypeConfigMap);
      if (!config) {
        return c.json({ error: 'Validation failed', message: 'eventType query parameter must be supported when provided' }, 400);
      }
      if (!verifyRole(c, config.allowedRoles)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }
    }

    try {
      const allowedEventTypes = Object.entries(eventTypeConfigMap)
        .filter(([, config]) => role && Array.isArray(config.allowedRoles) && config.allowedRoles.includes(role))
        .map(([configuredEventType]) => configuredEventType);

      if (!allowedEventTypes.length) {
        return c.json({ events: [], count: 0 });
      }

      if (eventType && !allowedEventTypes.includes(eventType)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const eventTypeFilter = eventType || null;
      const serviceDate = toStringOrNull(c.req.query('serviceDate'));
      const query = eventTypeFilter ? { eventType: eventTypeFilter } : { eventType: { $in: allowedEventTypes } };
      if (serviceDate) {
        query.serviceDate = serviceDate;
      }

      const calendarSlots = await safeCollectionFind('event_calendar', query);
      calendarSlots.sort((a, b) => {
        const dateCompare = String(a.serviceDate || '').localeCompare(String(b.serviceDate || ''));
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return String(a.serviceTime || '').localeCompare(String(b.serviceTime || ''));
      });

      const eventDefinitionsByType = new Map();
      const decorated = await Promise.all(calendarSlots.map(async (calendarSlot) => {
        const slotEventType = toStringOrNull(calendarSlot.eventType);
        if (!slotEventType) {
          return null;
        }

        if (!eventDefinitionsByType.has(slotEventType)) {
          const definition = await getOrCreateEventDefinition(slotEventType, null, eventTypeConfigMap);
          if (!definition) {
            return null;
          }
          eventDefinitionsByType.set(slotEventType, definition);
        }

        const eventDefinition = eventDefinitionsByType.get(slotEventType);
        const signups = await loadSignupsForCalendar(calendarSlot, eventDefinition);
        return buildCalendarView(calendarSlot, eventDefinition, signups);
      }));

      const filteredEvents = decorated.filter(Boolean);
      return c.json({ events: filteredEvents, count: filteredEvents.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching events:');
      return c.json({ error: 'Failed to fetch events', message: error.message }, 500);
    }
  });

  app.post('/api/events', async (c) => {
    try {
      const eventTypeConfigMap = await getEventTypeConfigMapFromDb();
      const body = await c.req.json();
      const explicitTitle = toStringOrNull(body?.title);
      const serviceTimes = normalizeServiceTimes(body);
      if (serviceTimes.length === 0) {
        return c.json({ error: 'Validation failed', message: 'Missing required field: serviceTime or serviceTimes is required' }, 400);
      }

      const normalized = normalizeEventBody({
        ...body,
        serviceTime: serviceTimes[0]
      }, eventTypeConfigMap);
      if (normalized.error) {
        return c.json({ error: 'Validation failed', message: normalized.error }, 400);
      }

      const config = getEventTypeConfig(normalized.data.eventType, eventTypeConfigMap);
      if (!verifyRole(c, config.assignmentRoles)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const eventDefinition = await getOrCreateEventDefinition(normalized.data.eventType, normalized.data.positions, eventTypeConfigMap);
      if (!eventDefinition || !eventDefinition._id) {
        return c.json({ error: 'Failed to resolve event definition' }, 500);
      }

      const createdEvents = [];
      const autoScheduledEvents = [];
      for (const serviceTime of serviceTimes) {
        const createdSlot = await createCalendarSlot({
          eventDefinition,
          serviceDate: normalized.data.serviceDate,
          serviceTime,
          title: explicitTitle,
          createdBy: c.req.memberId || null,
          failOnDuplicate: true
        });

        if (createdSlot.error) {
          return c.json({ error: 'Validation failed', message: createdSlot.error }, 400);
        }

        const eventView = buildCalendarView(createdSlot.calendarSlot, eventDefinition, []);
        createdEvents.push(eventView);

        const autoScheduled = await autoScheduleDependencies({
          parentCalendarSlot: createdSlot.calendarSlot,
          parentEventConfig: config,
          eventTypeConfigMap,
          createdBy: c.req.memberId || null
        });
        autoScheduledEvents.push(...autoScheduled);
      }

      return c.json({
        message: 'Event scheduled successfully',
        id: createdEvents[0]?._id || null,
        event: createdEvents[0] || null,
        events: createdEvents,
        autoScheduledEvents,
        count: createdEvents.length,
        autoScheduledCount: autoScheduledEvents.length
      });
    } catch (error) {
      getLogger().error(error, 'Error creating event:');
      return c.json({ error: 'Failed to create event', message: error.message }, 500);
    }
  });

  app.get('/api/events/:eventId', async (c) => {
    try {
      const eventTypeConfigMap = await getEventTypeConfigMapFromDb();
      const calendarId = c.req.param('eventId');
      const loaded = await loadCalendarAndDefinition(calendarId, eventTypeConfigMap);
      if (!loaded) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const config = getEventTypeConfig(loaded.eventDefinition.eventType, eventTypeConfigMap);
      if (!config || !verifyRole(c, config.allowedRoles)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const signups = await loadSignupsForCalendar(loaded.calendarSlot, loaded.eventDefinition);
      return c.json({
        event: buildCalendarView(loaded.calendarSlot, loaded.eventDefinition, signups),
        signups,
        signupCount: signups.length
      });
    } catch (error) {
      getLogger().error(error, 'Error fetching event details:');
      return c.json({ error: 'Failed to fetch event details', message: error.message }, 500);
    }
  });

  app.post('/api/events/:eventId/signups', async (c) => {
    try {
      const eventTypeConfigMap = await getEventTypeConfigMapFromDb();
      const calendarId = c.req.param('eventId');
      const loaded = await loadCalendarAndDefinition(calendarId, eventTypeConfigMap);
      if (!loaded) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const config = getEventTypeConfig(loaded.eventDefinition.eventType, eventTypeConfigMap);
      if (!config || !verifyRole(c, config.allowedRoles)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const body = await c.req.json();
      const requestedMemberId = toStringOrNull(body.memberId);
      const memberId = requestedMemberId && canManageOtherSignups(c.req.role, loaded.eventDefinition.eventType, eventTypeConfigMap) ? requestedMemberId : c.req.memberId;
      if (!memberId) {
        return c.json({ error: 'Validation failed', message: 'memberId is required' }, 400);
      }

      const requestedPositionId = toStringOrNull(body.positionId);
      if (requestedPositionId) {
        const requestedPosition = (loaded.eventDefinition.positions || []).find(position => position.positionId === requestedPositionId);
        if (!requestedPosition) {
          return c.json({ error: 'Validation failed', message: `Unknown positionId: ${requestedPositionId}` }, 400);
        }

        if (requestedPosition.allowSelfSignup === false) {
          return c.json({ error: 'Validation failed', message: `Position ${requestedPositionId} is assigned by event leadership` }, 400);
        }
      }

      const isAvailable = normalizeBoolean(body.isAvailable, true);
      const now = new Date().toISOString();

      let existing = await safeCollectionFindOne('event_signups', { calendarId, memberId });
      if (!existing) {
        existing = await safeCollectionFindOne('event_signups', { eventId: calendarId, memberId });
      }

      if (existing) {
        await safeCollectionUpdate(
          'event_signups',
          { _id: existing._id },
          {
            $set: {
              calendarId,
              eventId: loaded.eventDefinition._id,
              eventType: loaded.eventDefinition.eventType,
              positionId: requestedPositionId,
              isAvailable,
              unavailableReason: toStringOrNull(body.unavailableReason),
              updatedAt: now
            }
          }
        );
      } else {
        await safeCollectionInsert('event_signups', {
          calendarId,
          eventId: loaded.eventDefinition._id,
          eventType: loaded.eventDefinition.eventType,
          memberId,
          positionId: requestedPositionId,
          isAvailable,
          unavailableReason: toStringOrNull(body.unavailableReason),
          assignedPositionId: null,
          createdAt: now,
          updatedAt: now
        });
      }

      const updatedEvent = await rebuildAssignmentsForCalendar(loaded.calendarSlot, loaded.eventDefinition);
      return c.json({
        message: 'Event signup saved',
        event: updatedEvent
      });
    } catch (error) {
      getLogger().error(error, 'Error saving event signup:');
      return c.json({ error: 'Failed to save event signup', message: error.message }, 500);
    }
  });

  app.get('/api/events/:eventId/assignments', async (c) => {
    try {
      const eventTypeConfigMap = await getEventTypeConfigMapFromDb();
      const calendarId = c.req.param('eventId');
      const loaded = await loadCalendarAndDefinition(calendarId, eventTypeConfigMap);
      if (!loaded) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const config = getEventTypeConfig(loaded.eventDefinition.eventType, eventTypeConfigMap);
      if (!config) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const canManage = await canManageAssignments(c, loaded, eventTypeConfigMap);
      if (!canManage && !verifyRole(c, config.allowedRoles)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const event = await rebuildAssignmentsForCalendar(loaded.calendarSlot, loaded.eventDefinition);
      const { candidates, assigneeRoles } = await loadAssignmentCandidates(loaded.eventDefinition.eventType, eventTypeConfigMap);
      const members = await safeCollectionFind('members');
      const memberById = new Map(members.map(member => [member._id, member]));

      const printableAssignments = event.positions.map(position => {
        const assignedMember = position.assignedMemberId ? memberById.get(position.assignedMemberId) : null;
        return {
          ...position,
          assignedMember: assignedMember
            ? {
                _id: assignedMember._id,
                firstName: assignedMember.firstName,
                lastName: assignedMember.lastName,
                email: assignedMember.email
              }
            : null
        };
      });

      return c.json({
        event: {
          ...event,
          positions: printableAssignments
        },
        canManageAssignments: canManage,
        assignmentCandidates: candidates,
        assigneeRoles,
        openPositions: printableAssignments.filter(position => !position.assignedMember),
        filledPositions: printableAssignments.filter(position => position.assignedMember)
      });
    } catch (error) {
      getLogger().error(error, 'Error fetching event assignments:');
      return c.json({ error: 'Failed to fetch event assignments', message: error.message }, 500);
    }
  });

  app.put('/api/events/:eventId/assignments', async (c) => {
    try {
      const eventTypeConfigMap = await getEventTypeConfigMapFromDb();
      const calendarId = c.req.param('eventId');
      const loaded = await loadCalendarAndDefinition(calendarId, eventTypeConfigMap);
      if (!loaded) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const canManage = await canManageAssignments(c, loaded, eventTypeConfigMap);
      if (!canManage) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const { candidates } = await loadAssignmentCandidates(loaded.eventDefinition.eventType, eventTypeConfigMap);
      const allowedMemberIds = new Set(candidates.map(candidate => candidate._id));

      const body = await c.req.json();
      const updates = Array.isArray(body?.assignments) ? body.assignments : null;
      if (!updates) {
        return c.json({ error: 'Validation failed', message: 'assignments array is required' }, 400);
      }

      const normalizedPositions = normalizeEventPositions(loaded.eventDefinition.positions || []);
      const positionIds = new Set(normalizedPositions.map(position => position.positionId));

      const assignmentByPosition = new Map();
      for (const update of updates) {
        const positionId = toStringOrNull(update?.positionId);
        if (!positionId || !positionIds.has(positionId)) {
          return c.json({ error: 'Validation failed', message: `Unknown positionId: ${positionId || '(missing)'}` }, 400);
        }

        const memberId = toStringOrNull(update?.memberId);
        if (memberId && !allowedMemberIds.has(memberId)) {
          return c.json({ error: 'Validation failed', message: `Member is not eligible for assignment: ${memberId}` }, 400);
        }

        assignmentByPosition.set(positionId, memberId || null);
      }

      const now = new Date().toISOString();
      for (const position of normalizedPositions) {
        if (!assignmentByPosition.has(position.positionId)) {
          continue;
        }

        const memberId = assignmentByPosition.get(position.positionId);
        if (!memberId) {
          const signups = await safeCollectionFind('event_signups', {
            calendarId,
            assignedPositionId: position.positionId
          });
          for (const signup of signups) {
            await safeCollectionUpdate(
              'event_signups',
              { _id: signup._id },
              {
                $set: {
                  assignedPositionId: null,
                  updatedAt: now
                }
              }
            );
          }
          continue;
        }

        let signup = await safeCollectionFindOne('event_signups', { calendarId, memberId });
        if (!signup) {
          signup = await safeCollectionFindOne('event_signups', { eventId: calendarId, memberId });
        }

        if (signup) {
          await safeCollectionUpdate(
            'event_signups',
            { _id: signup._id },
            {
              $set: {
                calendarId,
                eventId: loaded.eventDefinition._id,
                eventType: loaded.eventDefinition.eventType,
                isAvailable: true,
                unavailableReason: null,
                assignedPositionId: position.positionId,
                updatedAt: now
              }
            }
          );
        } else {
          await safeCollectionInsert('event_signups', {
            calendarId,
            eventId: loaded.eventDefinition._id,
            eventType: loaded.eventDefinition.eventType,
            memberId,
            positionId: null,
            isAvailable: true,
            unavailableReason: null,
            assignedPositionId: position.positionId,
            createdAt: now,
            updatedAt: now
          });
        }

        const otherAssigned = await safeCollectionFind('event_signups', {
          calendarId,
          assignedPositionId: position.positionId
        });
        for (const other of otherAssigned) {
          if (other.memberId === memberId) {
            continue;
          }
          await safeCollectionUpdate(
            'event_signups',
            { _id: other._id },
            {
              $set: {
                assignedPositionId: null,
                updatedAt: now
              }
            }
          );
        }
      }

      const event = await rebuildAssignmentsForCalendar(loaded.calendarSlot, loaded.eventDefinition);
      const members = await safeCollectionFind('members');
      const memberById = new Map(members.map(member => [member._id, member]));

      const positions = event.positions.map(position => {
        const assignedMember = position.assignedMemberId ? memberById.get(position.assignedMemberId) : null;
        return {
          ...position,
          assignedMember: assignedMember
            ? {
                _id: assignedMember._id,
                firstName: assignedMember.firstName,
                lastName: assignedMember.lastName,
                email: assignedMember.email
              }
            : null
        };
      });

      return c.json({
        message: 'Assignments saved',
        event: {
          ...event,
          positions
        },
        canManageAssignments: true,
        assignmentCandidates: candidates,
        openPositions: positions.filter(position => !position.assignedMember),
        filledPositions: positions.filter(position => position.assignedMember)
      });
    } catch (error) {
      getLogger().error(error, 'Error updating event assignments:');
      return c.json({ error: 'Failed to update event assignments', message: error.message }, 500);
    }
  });
}
