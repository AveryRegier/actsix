import { getLogger } from '../util/logger.js';
import { safeCollectionFind, safeCollectionFindOne, safeCollectionInsert, safeCollectionUpdate, safeCollectionCount } from '../util/helpers.js';
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

function normalizeBinaryGender(value, fallback = 'male') {
  const normalized = toStringOrNull(value)?.toLowerCase();
  if (normalized === 'male' || normalized === 'female') {
    return normalized;
  }
  return fallback;
}

function normalizeRequiredGender(value) {
  const normalized = toStringOrNull(value)?.toLowerCase();
  if (normalized === 'male' || normalized === 'female') {
    return normalized;
  }
  return null;
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
        note: toStringOrNull(position.note),
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
    note: position.note,
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
  const fallbackQuickAddAssigneeRole = toStringOrNull(defaultSeed?.quickAddAssigneeRole);
  const fallbackAllowQuickAddAssignee = defaultSeed?.allowQuickAddAssignee !== false;
  const fallbackRequiredGender = normalizeRequiredGender(defaultSeed?.requiredGender);
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
    quickAddAssigneeRole: toStringOrNull(doc?.quickAddAssigneeRole) || fallbackQuickAddAssigneeRole,
    allowQuickAddAssignee: doc?.allowQuickAddAssignee !== undefined
      ? normalizeBoolean(doc?.allowQuickAddAssignee, true)
      : fallbackAllowQuickAddAssignee,
    requiredGender: normalizeRequiredGender(doc?.requiredGender) || fallbackRequiredGender,
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
    .filter(signup => signup && signup.isAvailable && signup.memberId && signup.assignmentOptOut !== true)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  const positionIds = new Set(normalizedPositions.map(position => position.positionId));
  const assignedByPosition = new Map();
  const assignedByMember = new Map();

  // Explicit assignment from management UI should win over all other strategies.
  for (const signup of availableSignups) {
    const explicitPositionId = toStringOrNull(signup.assignedPositionId);
    if (!explicitPositionId || !positionIds.has(explicitPositionId)) {
      continue;
    }

    if (assignedByPosition.has(explicitPositionId) || assignedByMember.has(signup.memberId)) {
      continue;
    }

    assignedByPosition.set(explicitPositionId, signup.memberId);
    assignedByMember.set(signup.memberId, explicitPositionId);
  }

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

// Schedulable types own their auto-scheduled dependents (e.g. setup/cleanup), so one cancel covers the whole activity.
// presentTypes (event types scheduled that day) disambiguates dependents shared by several owner types.
export function resolveCancelGroup(eventType, eventTypeConfigMap = null, presentTypes = null) {
  const source = eventTypeConfigMap || getDefaultEventTypeConfigMap();
  const config = source[eventType];
  let root = config && config.isSchedulable !== false ? config : null;
  if (!root) {
    const owners = Object.values(source)
      .filter(candidate => candidate && candidate.isSchedulable !== false
        && Array.isArray(candidate.scheduleDependencies)
        && candidate.scheduleDependencies.some(dependency => dependency.eventType === eventType))
      .sort((a, b) => String(a.eventType).localeCompare(String(b.eventType)));
    const present = presentTypes ? new Set(presentTypes) : null;
    root = (present && owners.find(owner => present.has(owner.eventType))) || owners[0] || null;
  }
  if (!root) {
    return { key: eventType || null, title: config?.title || eventType || 'Event' };
  }
  return { key: root.eventType, title: root.title || root.eventType };
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
    isCancelled: false,
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
      created.push(await buildCalendarView(createdSlot.calendarSlot, targetDefinition));
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

function getAssigneeRolesForEventType(eventType, eventTypeConfigMap = null) {
  const config = getEventTypeConfig(eventType, eventTypeConfigMap);
  const configured = normalizeRoleList(config?.assigneeRoles);
  if (configured.length > 0) {
    return configured;
  }

  const fallback = normalizeRoleList(config?.allowedRoles);
  return fallback.length > 0 ? fallback : ['deacon', 'elder', 'usher'];
}

function getQuickAddRoleForEventType(eventType, eventTypeConfigMap = null) {
  const config = getEventTypeConfig(eventType, eventTypeConfigMap);
  const quickAddRole = toStringOrNull(config?.quickAddAssigneeRole);
  const assigneeRoles = getAssigneeRolesForEventType(eventType, eventTypeConfigMap);
  if (quickAddRole && assigneeRoles.includes(quickAddRole)) {
    return quickAddRole;
  }

  return assigneeRoles[0] || 'usher';
}

async function loadAssignmentCandidates(eventType, eventTypeConfigMap = null) {
  const config = getEventTypeConfig(eventType, eventTypeConfigMap);
  const assigneeRoles = getAssigneeRolesForEventType(eventType, eventTypeConfigMap);
  const quickAddAssigneeRole = getQuickAddRoleForEventType(eventType, eventTypeConfigMap);
  const allowQuickAddAssignee = config?.allowQuickAddAssignee !== false;
  const requiredGender = normalizeRequiredGender(config?.requiredGender);
  const members = await safeCollectionFind('members', { tags: { $in: assigneeRoles } });

  const unique = new Map();
  for (const member of members) {
    if (!member?._id) {
      continue;
    }
    if (Array.isArray(member.tags) && member.tags.includes('deceased')) {
      continue;
    }
    if (requiredGender && normalizeRequiredGender(member.gender) !== requiredGender) {
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
    assigneeRoles,
    quickAddAssigneeRole,
    allowQuickAddAssignee,
    requiredGender
  };
}

function parseNameParts(fullName) {
  const normalized = toStringOrNull(fullName);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function isLeadershipAssignmentPosition(position) {
  if (!position) {
    return false;
  }

  if (position.allowSelfSignup === false) {
    return true;
  }

  return false;
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

    const lockedPositionIds = normalizeEventPositions(loaded.eventDefinition.positions || [])
      .filter(position => isLeadershipAssignmentPosition(position))
      .map(position => position.positionId);
    if (lockedPositionIds.length === 0) {
      continue;
    }

    const memberSignup = await safeCollectionFindOne('event_signups', { calendarId: slot._id, memberId });
    if (memberSignup?.assignedPositionId && lockedPositionIds.includes(memberSignup.assignedPositionId)) {
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
  const member = await safeCollectionFindOne('members', { _id: memberId });
  if (member?.tags?.includes('admin')) {
    return true;
  }

  return memberHasLeadershipAccessOnServiceDate(memberId, loaded?.calendarSlot?.serviceDate, eventTypeConfigMap);
}

async function getAssignedMembersByPosition(calendarId) {
  const assignedSignups = await safeCollectionFind('event_signups', { calendarId, assignedPositionId: { $ne: null } });
  const byPosition = new Map();
  for (const signup of assignedSignups) {
    if (signup?.assignedPositionId) {
      byPosition.set(signup.assignedPositionId, signup.memberId);
    }
  }
  return byPosition;
}

async function buildCalendarView(calendarSlot, eventDefinition) {
  const normalizedPositions = normalizeDefinitionPositions(eventDefinition.positions || []);
  const assignedByPosition = await getAssignedMembersByPosition(calendarSlot._id);
  const positions = normalizedPositions.map(position => ({
    ...position,
    assignedMemberId: assignedByPosition.get(position.positionId) || null
  }));
  const status = deriveEventStatusFromPositions(positions);
  const criticalPositionIds = positions.filter(position => position.isCritical).map(position => position.positionId);

  return {
    _id: calendarSlot._id,
    calendarId: calendarSlot._id,
    eventId: eventDefinition._id,
    eventType: eventDefinition.eventType,
    eventSubtype: eventDefinition.eventSubtype || null,
    title: toStringOrNull(calendarSlot.title) || buildDefaultTitle(eventDefinition.eventType, calendarSlot.serviceDate, calendarSlot.serviceTime),
    serviceDate: calendarSlot.serviceDate,
    serviceTime: calendarSlot.serviceTime,
    positions,
    neededCount: positions.length,
    criticalPositionIds,
    status,
    isCancelled: calendarSlot.isCancelled === true,
    cancelledAt: calendarSlot.cancelledAt || null,
    cancelledBy: calendarSlot.cancelledBy || null,
    createdAt: calendarSlot.createdAt,
    updatedAt: calendarSlot.updatedAt
  };
}

// Lightweight status derived purely from the calendar doc's own counts, using
// indexed countDocuments lookups instead of loading and re-assigning every signup.
async function getEventStatusFromCalendarDoc(calendarDoc) {
  const criticalPositionIds = Array.isArray(calendarDoc?.criticalPositionIds) ? calendarDoc.criticalPositionIds : [];
  const totalPositions = calendarDoc?.neededCount || 0;
  const criticalTotal = criticalPositionIds.length;
  const calendarId = calendarDoc._id;

  const [filledCount, criticalFilledCount] = await Promise.all([
    safeCollectionCount('event_signups', { calendarId, assignedPositionId: { $ne: null } }),
    criticalTotal > 0
      ? safeCollectionCount('event_signups', { calendarId, assignedPositionId: { $in: criticalPositionIds } })
      : Promise.resolve(0)
  ]);

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

async function findOpenPositionId(calendarId, positions, preferredPositionId = null) {
  const occupiable = normalizeEventPositions(positions).filter(position => position.allowSelfSignup !== false);
  if (occupiable.length === 0) {
    return null;
  }

  const occupied = await getAssignedMembersByPosition(calendarId);

  if (preferredPositionId && occupiable.some(position => position.positionId === preferredPositionId) && !occupied.has(preferredPositionId)) {
    return preferredPositionId;
  }

  const next = occupiable.find(position => !occupied.has(position.positionId));
  return next ? next.positionId : null;
}

async function findMemberSignup(calendarId, memberId) {
  let signup = await safeCollectionFindOne('event_signups', { calendarId, memberId });
  if (!signup) {
    signup = await safeCollectionFindOne('event_signups', { eventId: calendarId, memberId });
  }
  return signup;
}

// Sign a member up as available and, if a position is open, grab it directly.
// Does not touch any other member's signup - no reassignment loop.
async function markMemberAvailable(loaded, memberId, { requestedPositionId = null, unavailableReason = null } = {}) {
  const calendarId = loaded.calendarSlot._id;
  const positions = loaded.eventDefinition.positions || [];
  const signup = await findMemberSignup(calendarId, memberId);

  const alreadyHoldsValidPosition = signup?.assignedPositionId
    && normalizeEventPositions(positions).some(position => position.positionId === signup.assignedPositionId);

  const assignedPositionId = alreadyHoldsValidPosition
    ? signup.assignedPositionId
    : await findOpenPositionId(calendarId, positions, requestedPositionId);

  const now = new Date().toISOString();
  const fields = {
    calendarId,
    eventId: loaded.eventDefinition._id,
    eventType: loaded.eventDefinition.eventType,
    memberId,
    positionId: requestedPositionId,
    isAvailable: true,
    unavailableReason,
    assignedPositionId,
    updatedAt: now
  };

  if (signup) {
    await safeCollectionUpdate('event_signups', { _id: signup._id }, { $set: fields });
  } else {
    await safeCollectionInsert('event_signups', { ...fields, createdAt: now });
  }

  return assignedPositionId;
}

// Mark a member unavailable and free only their own position - no loop over other signups.
async function markMemberUnavailable(loaded, memberId, unavailableReason = null) {
  const calendarId = loaded.calendarSlot._id;
  const signup = await findMemberSignup(calendarId, memberId);
  const now = new Date().toISOString();
  const fields = {
    calendarId,
    eventId: loaded.eventDefinition._id,
    eventType: loaded.eventDefinition.eventType,
    isAvailable: false,
    assignedPositionId: null,
    unavailableReason,
    updatedAt: now
  };

  if (signup) {
    await safeCollectionUpdate('event_signups', { _id: signup._id }, { $set: fields });
  } else {
    await safeCollectionInsert('event_signups', {
      ...fields,
      memberId,
      positionId: null,
      createdAt: now
    });
  }
}

// Free whichever single signup currently holds this position; returns their memberId, if any.
async function clearPositionOccupant(calendarId, positionId) {
  const occupant = await safeCollectionFindOne('event_signups', { calendarId, assignedPositionId: positionId });
  if (!occupant) {
    return null;
  }

  await safeCollectionUpdate(
    'event_signups',
    { _id: occupant._id },
    { $set: { assignedPositionId: null, updatedAt: new Date().toISOString() } }
  );
  return occupant.memberId;
}

// Directly place one member into a position. Frees whoever previously held that position
// (they become unassigned, not reassigned elsewhere) and moves the member off any other
// position they held. No loop over the rest of the roster.
async function assignMemberToPosition(loaded, memberId, positionId) {
  const calendarId = loaded.calendarSlot._id;
  const now = new Date().toISOString();

  await clearPositionOccupant(calendarId, positionId);

  const signup = await findMemberSignup(calendarId, memberId);
  const fields = {
    calendarId,
    eventId: loaded.eventDefinition._id,
    eventType: loaded.eventDefinition.eventType,
    memberId,
    isAvailable: true,
    unavailableReason: null,
    assignedPositionId: positionId,
    updatedAt: now
  };

  if (signup) {
    await safeCollectionUpdate('event_signups', { _id: signup._id }, { $set: fields });
  } else {
    await safeCollectionInsert('event_signups', { ...fields, positionId: null, createdAt: now });
  }
}

async function loadSignupsForCalendar(calendarId, eventId = null) {
  const normalizedCalendarId = toStringOrNull(calendarId);
  const normalizedEventId = toStringOrNull(eventId);

  const lookups = [
    safeCollectionFind('event_signups', { calendarId })
  ];

  if (normalizedCalendarId && normalizedCalendarId !== calendarId) {
    lookups.push(safeCollectionFind('event_signups', { calendarId: normalizedCalendarId }));
  }

  if (normalizedEventId) {
    lookups.push(safeCollectionFind('event_signups', { eventId: normalizedEventId }));
  }

  const batches = await Promise.all(lookups);
  const deduped = new Map();
  for (const batch of batches) {
    for (const signup of batch || []) {
      if (signup?._id) {
        deduped.set(signup._id, signup);
      }
    }
  }

  return Array.from(deduped.values());
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
  /**
   * @route POST /api/events/types
   * @description Create or update an event-type configuration document.
   * @usedByPage None found.
   * @usedByScript None found.
   */
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

  /**
   * @route GET /api/events/types
   * @description List schedulable event types visible to the caller role.
   * @usedByPage site/event-schedule-page.js
   * @usedByScript None found.
   */
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

  /**
   * @route GET /api/events
   * @description List scheduled calendar events, optionally filtered by eventType and serviceDate.
   * @usedByPage site/event-schedule-page.js, site/sign-ups-page.js
   * @usedByScript None found.
   */
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
        return buildCalendarView(calendarSlot, eventDefinition);
      }));

      const filteredEvents = decorated.filter(Boolean);
      return c.json({ events: filteredEvents, count: filteredEvents.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching events:');
      return c.json({ error: 'Failed to fetch events', message: error.message }, 500);
    }
  });

  /**
   * @route POST /api/events
   * @description Create one or more scheduled event slots and auto-schedule configured dependencies.
   * @usedByPage site/event-schedule-page.js
   * @usedByScript None found.
   */
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

        const eventView = await buildCalendarView(createdSlot.calendarSlot, eventDefinition);
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

  /**
   * @route GET /api/events/:eventId
   * @description Get full event detail (calendar slot plus computed signup/assignment state).
   * @usedByPage site/sign-ups-page.js
   * @usedByScript None found.
   */
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
        event: await buildCalendarView(loaded.calendarSlot, loaded.eventDefinition),
        signups,
        signupCount: signups.length
      });
    } catch (error) {
      getLogger().error(error, 'Error fetching event details:');
      return c.json({ error: 'Failed to fetch event details', message: error.message }, 500);
    }
  });

  /**
   * @route PUT /api/events/:eventId/cancel
   * @description Cancel one scheduled event occurrence.
   * @usedByPage None found.
   * @usedByScript None found.
   */
  app.put('/api/events/:eventId/cancel', async (c) => {
    try {
      const eventTypeConfigMap = await getEventTypeConfigMapFromDb();
      const calendarId = c.req.param('eventId');
      const loaded = await loadCalendarAndDefinition(calendarId, eventTypeConfigMap);
      if (!loaded) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const config = getEventTypeConfig(loaded.eventDefinition.eventType, eventTypeConfigMap);
      if (!config || !(await canManageAssignments(c, loaded, eventTypeConfigMap))) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      let calendarSlot = loaded.calendarSlot;
      if (calendarSlot.isCancelled !== true) {
        const now = new Date().toISOString();
        const cancellation = {
          isCancelled: true,
          cancelledAt: now,
          cancelledBy: c.req.memberId || null,
          updatedAt: now
        };
        await safeCollectionUpdate(
          'event_calendar',
          { _id: calendarId },
          { $set: cancellation }
        );
        calendarSlot = { ...calendarSlot, ...cancellation };
      }

      return c.json({
        message: 'Event cancelled',
        event: await buildCalendarView(calendarSlot, loaded.eventDefinition)
      });
    } catch (error) {
      getLogger().error(error, 'Error cancelling event:');
      return c.json({ error: 'Failed to cancel event', message: error.message }, 500);
    }
  });

  /**
   * @route GET /api/events/:eventId/assignments
   * @description Get assignment board view for one event, including candidates and manage flags.
   * @usedByPage site/event-assignments-page.js
   * @usedByScript None found.
   */
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
      if (!canManage && !(await verifyRole(c, config.allowedRoles))) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const event = await buildCalendarView(loaded.calendarSlot, loaded.eventDefinition);
      const { candidates, assigneeRoles, quickAddAssigneeRole, allowQuickAddAssignee, requiredGender } = await loadAssignmentCandidates(loaded.eventDefinition.eventType, eventTypeConfigMap);
      
      const assignedMemberIds = new Set(event.positions.map(p => p.assignedMemberId).filter(Boolean));
      const members = await safeCollectionFind('members', { _id: { $in: [...assignedMemberIds] } });
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
        cancelGroup: resolveCancelGroup(
          event.eventType,
          eventTypeConfigMap,
          (await safeCollectionFind('event_calendar', { serviceDate: event.serviceDate })).map(slot => slot.eventType)
        ),
        assignmentCandidates: candidates,
        assigneeRoles,
        quickAddAssigneeRole,
        allowQuickAddAssignee,
        requiredGender,
        openPositions: printableAssignments.filter(position => !position.assignedMember),
        filledPositions: printableAssignments.filter(position => position.assignedMember)
      });
    } catch (error) {
      getLogger().error(error, 'Error fetching event assignments:');
      return c.json({ error: 'Failed to fetch event assignments', message: error.message }, 500);
    }
  });

  /**
   * @route GET /api/member/assignments
   * @description Return the current member upcoming events with signup state attached.
   * @usedByPage site/sign-ups-page.js
   * @usedByScript None found.
   */
  app.get('/api/member/assignments', async (c) => {
    try {
      // Corrected role validation as per the new plan
      verifyRole(c, ['deacon', 'staff', 'elder', 'usher']);
      const memberId = c.req.memberId;
      if (!memberId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      // 1. Get all future calendar events
      const today = new Date().toISOString().split('T')[0];
      const futureEvents = (await safeCollectionFind('event_calendar', { serviceDate: { $gte: today } }))
        .filter(event => event.isCancelled !== true);

      if (!futureEvents || futureEvents.length === 0) {
        return c.json([]);
      }

      const eventIds = futureEvents.map(e => e._id);
      const eventTypes = [...new Set(futureEvents.map(e => e.eventType).filter(Boolean))];

      // 2. Get all relevant event types and member signups in parallel
      const [eventTypeConfigs, memberSignups] = await Promise.all([
        safeCollectionFind('event_types', { eventType: { $in: eventTypes } }),
        safeCollectionFind('event_signups', { memberId, calendarId: { $in: eventIds } })
      ]);

      // Create lookup maps for efficient data joining
      const definitionsByEventType = new Map(eventTypeConfigs.map(def => [def.eventType, def]));
      const signupsByCalendarId = new Map(memberSignups.map(s => [s.calendarId, s]));

      // 3. Get filled-position status for each event using indexed counts only - no reassignment loop.
      const statusPairs = await Promise.all(futureEvents.map(async event => [event._id, await getEventStatusFromCalendarDoc(event)]));
      const statusByEventId = new Map(statusPairs);

      // 4. Combine the data
      const results = [];
      for (const event of futureEvents) {
        const definition = definitionsByEventType.get(event.eventType);
        const signup = signupsByCalendarId.get(event._id);

        // Each event becomes an entry, enhanced with signup info
        results.push({
          event: { ...event, status: statusByEventId.get(event._id) },
          definition,
          signup: signup || null // Include the member's signup if it exists
        });
      }

      return c.json(results);
    } catch (error) {
      getLogger().error(error, 'Error fetching member assignments:', { error });
      return c.json({ error: 'Failed to fetch member assignments', message: error.message }, 500);
    }
  });

  /**
   * @route GET /api/event-assignments
   * @description Return assignment snapshots for all events on a specific serviceDate.
   * @usedByPage site/event-assignments-page.js
   * @usedByScript None found.
   */
  app.get('/api/event-assignments', async (c) => {
    try {
      if (!(await verifyRole(c, ['deacon', 'staff', 'elder', 'usher', 'helper']))) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }
      const serviceDate = c.req.query('serviceDate');

      if (!serviceDate) {
        return c.json({ error: 'serviceDate query parameter is required' }, 400);
      }

      // 1. Get all events for the specified date
      const events = (await safeCollectionFind('event_calendar', { serviceDate }))
        .filter(event => event.isCancelled !== true);

      if (!events || events.length === 0) {
        return c.json([]);
      }

      // 2. Get event type config (titles) and each event's real position definition
      const eventTypeConfigMap = await getEventTypeConfigMapFromDb();
      const eventTypeNames = [...new Set(events.map(e => e.eventType).filter(Boolean))];
      const definitionsByType = new Map();
      for (const eventType of eventTypeNames) {
        definitionsByType.set(eventType, await getOrCreateEventDefinition(eventType, null, eventTypeConfigMap));
      }

      // 3. Fetch only the already-assigned signups per event - a single indexed lookup each,
      // no full-roster load and no reassignment loop.
      const assignedByCalendarId = new Map();
      await Promise.all(events.map(async event => {
        assignedByCalendarId.set(event._id, await getAssignedMembersByPosition(event._id));
      }));

      const assignedIds = new Set();
      for (const assignedByPosition of assignedByCalendarId.values()) {
        for (const memberId of assignedByPosition.values()) {
          assignedIds.add(memberId);
        }
      }

      // 4. Get all assigned members for enrichment
      const members = assignedIds.size > 0
        ? await safeCollectionFind('members', { _id: { $in: [...assignedIds] } })
        : [];
      const memberMap = new Map(members.map(m => [m._id, m]));

      // 5. Combine all data and format for frontend
      const results = await Promise.all(events.map(async event => {
        const definition = definitionsByType.get(event.eventType);
        const eventTypeConfig = eventTypeConfigMap[event.eventType];
        const assignedByPosition = assignedByCalendarId.get(event._id) || new Map();
        const normalizedPositions = normalizeDefinitionPositions(definition?.positions || []);

        // Enrich positions with member details
        const enrichedPositions = normalizedPositions.map(position => {
          const assignedMemberId = assignedByPosition.get(position.positionId) || null;
          return {
            ...position,
            assignedMemberId,
            assignedMember: assignedMemberId ? memberMap.get(assignedMemberId) || null : null
          };
        });

        // Separate filled and open positions
        const filledPositions = enrichedPositions.filter(p => p.assignedMemberId);
        const openPositions = enrichedPositions.filter(p => !p.assignedMemberId);

        const canManage = definition
          ? await canManageAssignments(c, { calendarSlot: event, eventDefinition: definition }, eventTypeConfigMap)
          : false;

        return {
          event,
          positions: enrichedPositions,
          filledPositions,
          openPositions,
          status: deriveEventStatusFromPositions(enrichedPositions),
          eventType: eventTypeConfig ? eventTypeConfig.title : event.eventType,
          cancelGroup: resolveCancelGroup(event.eventType, eventTypeConfigMap, eventTypeNames),
          canManageAssignments: canManage
        };
      }));

      return c.json(results);
    } catch (error) {
      getLogger().error(error, 'Error fetching assignments for date:', { error });
      return c.json({ error: 'Failed to fetch assignments', message: error.message }, 500);
    }
  });

  /**
   * @route PUT /api/events/:eventId/assignments
   * @description Save leadership assignments for event positions.
   * @usedByPage site/event-assignments-page.js
   * @usedByScript None found.
   */
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

      const { candidates, assigneeRoles, quickAddAssigneeRole, allowQuickAddAssignee, requiredGender } = await loadAssignmentCandidates(loaded.eventDefinition.eventType, eventTypeConfigMap);
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

      // Each update only touches the specific position (and whoever it bumps) - no roster-wide loop.
      for (const position of normalizedPositions) {
        if (!assignmentByPosition.has(position.positionId)) {
          continue;
        }

        const memberId = assignmentByPosition.get(position.positionId);
        if (!memberId) {
          await clearPositionOccupant(calendarId, position.positionId);
          continue;
        }

        await assignMemberToPosition(loaded, memberId, position.positionId);
      }

      const event = await buildCalendarView(loaded.calendarSlot, loaded.eventDefinition);

      const memberById = new Map();
      async function getMemberById(memberId) {
        let member = memberById.get(memberId);
        if (!member) {
          member = await safeCollectionFindOne('members', {_id: memberId});
          memberById.set(memberId, member);
        }
        return member;
      }

      const positions = await Promise.all(event.positions.map(async position => {
        const assignedMember = position.assignedMemberId ? await getMemberById(position.assignedMemberId) : null;
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
      }));

      return c.json({
        message: 'Assignments saved',
        event: {
          ...event,
          positions
        },
        canManageAssignments: true,
        assignmentCandidates: candidates,
        assigneeRoles,
        quickAddAssigneeRole,
        allowQuickAddAssignee,
        requiredGender,
        openPositions: positions.filter(position => !position.assignedMember),
        filledPositions: positions.filter(position => position.assignedMember)
      });
    } catch (error) {
      getLogger().error(error, 'Error updating event assignments:');
      return c.json({ error: 'Failed to update event assignments', message: error.message }, 500);
    }
  });

  /**
   * @route PUT /api/events/:eventId/signup
   * @description Toggle current member availability for one event.
   * @usedByPage site/sign-ups-page.js
   * @usedByScript None found.
   */
  app.put('/api/events/:eventId/signup', async (c) => {
    try {
      verifyRole(c, ['deacon', 'staff', 'elder', 'usher']);
      const memberId = c.req.memberId;
      if (!memberId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const calendarId = c.req.param('eventId');
      const { isAvailable } = await c.req.json();

      if (typeof isAvailable !== 'boolean') {
        return c.json({ error: 'isAvailable must be a boolean' }, 400);
      }

      const eventTypeConfigMap = await getEventTypeConfigMapFromDb();
      const loaded = await loadCalendarAndDefinition(calendarId, eventTypeConfigMap);
      if (!loaded) {
        return c.json({ error: 'Event not found' }, 404);
      }

      // Available -> grab the next open position directly. Unavailable -> free only this member's
      // own position. Neither path touches any other signup, so there is no roster-wide loop.
      if (isAvailable) {
        await markMemberAvailable(loaded, memberId);
      } else {
        await markMemberUnavailable(loaded, memberId);
      }

      return c.json({ message: 'Availability updated successfully' });
    } catch (error) {
      getLogger().error(error, 'Error updating member availability:');
      return c.json({ error: 'Failed to update availability', message: error.message }, 500);
    }
  });

  /**
   * @route POST /api/events/:eventId/assignment-candidates
   * @description Quick-create an assignment candidate member and household for this event type.
   * @usedByPage site/event-assignments-page.js
   * @usedByScript None found.
   */
  app.post('/api/events/:eventId/assignment-candidates', async (c) => {
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

      const body = await c.req.json();
      let firstName = toStringOrNull(body?.firstName);
      let lastName = toStringOrNull(body?.lastName);

      if (!firstName || !lastName) {
        const parsed = parseNameParts(body?.fullName);
        if (parsed) {
          firstName = firstName || parsed.firstName;
          lastName = lastName || parsed.lastName;
        }
      }

      if (!firstName || !lastName) {
        return c.json({ error: 'Validation failed', message: 'firstName and lastName are required (or provide fullName with first and last name)' }, 400);
      }

      const { assigneeRoles, quickAddAssigneeRole, allowQuickAddAssignee, requiredGender } = await loadAssignmentCandidates(loaded.eventDefinition.eventType, eventTypeConfigMap);
      if (!allowQuickAddAssignee) {
        return c.json({ error: 'Validation failed', message: 'Quick add is disabled for this event type' }, 400);
      }

      const requestedRole = toStringOrNull(body?.role) || quickAddAssigneeRole;
      const roleTag = assigneeRoles.includes(requestedRole) ? requestedRole : quickAddAssigneeRole;
      if (!roleTag) {
        return c.json({ error: 'Validation failed', message: 'No eligible assignee role is configured for this event type' }, 400);
      }

      const requestedGender = normalizeRequiredGender(body?.gender);
      const memberGender = requiredGender || requestedGender;
      if (!memberGender) {
        return c.json({ error: 'Validation failed', message: 'gender is required when event type does not specify requiredGender' }, 400);
      }

      const now = new Date().toISOString();
      const householdResult = await safeCollectionInsert('households', {
        lastName,
        createdAt: now,
        updatedAt: now
      });
      const householdId = householdResult.insertedId?.toString();

      const memberDoc = {
        firstName,
        lastName,
        relationship: 'other',
        gender: normalizeBinaryGender(memberGender, 'male'),
        householdId,
        tags: [roleTag],
        createdAt: now,
        updatedAt: now
      };

      const memberResult = await safeCollectionInsert('members', memberDoc);
      const memberId = memberResult.insertedId?.toString();

      return c.json({
        message: 'Assignment candidate created',
        candidate: {
          _id: memberId,
          firstName,
          lastName,
          email: '',
          tags: [roleTag],
          gender: memberGender,
          householdId
        }
      });
    } catch (error) {
      getLogger().error(error, 'Error creating assignment candidate:');
      return c.json({ error: 'Failed to create assignment candidate', message: error.message }, 500);
    }
  });
}
