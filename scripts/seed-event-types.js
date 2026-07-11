import { db } from '../src/util/sengoClient.js';

/**
 * Reusable position maps. Add new maps here, then reference them from EVENT_TYPE_VARIANTS.
 */
const POSITION_MAPS = {
  lords_supper_standard_8: [
    { positionId: 'PF1', label: 'Front Left', priority: 1, isCritical: true },
    { positionId: 'PF2', label: 'Front Center Left', priority: 2, isCritical: true },
    { positionId: 'PF3', label: 'Front Center Right', priority: 3, isCritical: true },
    { positionId: 'PF4', label: 'Front Right', priority: 4, isCritical: true },
    { positionId: 'PM1', label: 'Middle Left', priority: 5, isCritical: false },
    { positionId: 'PM2', label: 'Middle Right', priority: 6, isCritical: false },
    { positionId: 'PB1', label: 'Back Left', priority: 7, isCritical: false },
    { positionId: 'PB2', label: 'Back Right', priority: 8, isCritical: false }
  ],
  lords_supper_compact_6: [
    { positionId: 'PF1', label: 'Front Left', priority: 1, isCritical: true },
    { positionId: 'PF2', label: 'Front Right', priority: 2, isCritical: true },
    { positionId: 'PM1', label: 'Middle Left', priority: 3, isCritical: true },
    { positionId: 'PM2', label: 'Middle Right', priority: 4, isCritical: true },
    { positionId: 'PB1', label: 'Back Left', priority: 5, isCritical: false },
    { positionId: 'PB2', label: 'Back Right', priority: 6, isCritical: false }
  ],
  lords_supper_extended_10: [
    { positionId: 'PF1', label: 'Front Left', priority: 1, isCritical: true },
    { positionId: 'PF2', label: 'Front Center Left', priority: 2, isCritical: true },
    { positionId: 'PF3', label: 'Front Center Right', priority: 3, isCritical: true },
    { positionId: 'PF4', label: 'Front Right', priority: 4, isCritical: true },
    { positionId: 'PM1', label: 'Middle Left', priority: 5, isCritical: false },
    { positionId: 'PM2', label: 'Middle Right', priority: 6, isCritical: false },
    { positionId: 'PM3', label: 'Middle Extra Left', priority: 7, isCritical: false },
    { positionId: 'PM4', label: 'Middle Extra Right', priority: 8, isCritical: false },
    { positionId: 'PB1', label: 'Back Left', priority: 9, isCritical: false },
    { positionId: 'PB2', label: 'Back Right', priority: 10, isCritical: false }
  ],
  lords_supper_setup_team: [
    { positionId: 'PREP1', label: 'Preparation Team 1', priority: 1, isCritical: true },
    { positionId: 'PREP2', label: 'Preparation Team 2', priority: 2, isCritical: true },
    { positionId: 'TRAINEE', label: 'Preparation Trainee', priority: 3, isCritical: false }
  ],
  lords_supper_leadership_team: [
    { positionId: 'LEADER', label: 'Event Leader', priority: 1, isCritical: true, allowSelfSignup: false },
    { positionId: 'ASSIST', label: 'Event Assistant', priority: 2, isCritical: false }
  ],
  lords_supper_cleanup_team: [
    { positionId: 'CLEAN1', label: 'Cleanup Team 1', priority: 1, isCritical: true },
    { positionId: 'CLEAN2', label: 'Cleanup Team 2', priority: 2, isCritical: true },
    { positionId: 'CLEAN3', label: 'Cleanup Team 3', priority: 3, isCritical: true }
  ]
};

/**
 * Event-type variants to seed.
 * Add new variants by adding objects here and referencing a POSITION_MAPS key.
 */
const EVENT_TYPE_VARIANTS = [
  {
    eventType: 'lords-supper-standard',
    title: "Lord's Supper (Standard)",
    positionMap: 'lords_supper_standard_8',
    allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon', 'elder', 'usher'],
    scheduleDependencies: [
      { eventType: 'lords-supper-leadership', offsetMinutes: -30, uniquePer: 'day' },
      { eventType: 'lords-supper-setup', offsetMinutes: -60, uniquePer: 'day' },
      { eventType: 'lords-supper-cleanup', offsetMinutes: 60, uniquePer: 'slot' }
    ],
    isActive: true
  },
  {
    eventType: 'lords-supper-compact',
    title: "Lord's Supper (Compact)",
    positionMap: 'lords_supper_compact_6',
    allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon', 'elder', 'usher'],
    scheduleDependencies: [
      { eventType: 'lords-supper-leadership', offsetMinutes: -30, uniquePer: 'day' },
      { eventType: 'lords-supper-setup', offsetMinutes: -60, uniquePer: 'day' },
      { eventType: 'lords-supper-cleanup', offsetMinutes: 60, uniquePer: 'slot' }
    ],
    isActive: true
  },
  {
    eventType: 'lords-supper-extended',
    title: "Lord's Supper (Extended)",
    positionMap: 'lords_supper_extended_10',
    allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon', 'elder', 'usher'],
    scheduleDependencies: [
      { eventType: 'lords-supper-leadership', offsetMinutes: -30, uniquePer: 'day' },
      { eventType: 'lords-supper-setup', offsetMinutes: -60, uniquePer: 'day' },
      { eventType: 'lords-supper-cleanup', offsetMinutes: 60, uniquePer: 'slot' }
    ],
    isActive: true
  },
  {
    eventType: 'lords-supper-leadership',
    title: "Lord's Supper Leadership",
    positionMap: 'lords_supper_leadership_team',
    allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon', 'elder', 'usher'],
    isSchedulable: false,
    isActive: true
  },
  {
    eventType: 'lords-supper-setup',
    title: "Lord's Supper Setup",
    positionMap: 'lords_supper_setup_team',
    allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon', 'elder', 'usher'],
    isSchedulable: false,
    isActive: true
  },
  {
    eventType: 'lords-supper-cleanup',
    title: "Lord's Supper Cleanup",
    positionMap: 'lords_supper_cleanup_team',
    allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon', 'elder', 'usher'],
    isSchedulable: false,
    isActive: true
  }
];

function normalizeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean)));
}

function normalizePositionMap(positions) {
  const rows = Array.isArray(positions) ? positions : [];
  const normalized = rows
    .map((position, index) => ({
      positionId: String(position.positionId || `P${index + 1}`).trim(),
      label: String(position.label || `Position ${index + 1}`).trim(),
      priority: Number.isFinite(Number(position.priority)) && Number(position.priority) > 0
        ? Number(position.priority)
        : index + 1,
      isCritical: Boolean(position.isCritical),
      allowSelfSignup: position.allowSelfSignup !== false
    }))
    .filter(position => position.positionId && position.label);

  normalized.sort((a, b) => a.priority - b.priority);
  return normalized;
}

function buildEventTypeDoc(variant, nowIso) {
  const mapKey = variant.positionMap;
  const map = POSITION_MAPS[mapKey];
  if (!map) {
    throw new Error(`Unknown positionMap '${mapKey}' for eventType '${variant.eventType}'`);
  }

  const eventType = String(variant.eventType || '').trim();
  if (!eventType) {
    throw new Error('eventType is required on every variant');
  }

  const title = String(variant.title || eventType).trim();
  const allowedRoles = normalizeList(variant.allowedRoles);
  const assignmentRoles = normalizeList(variant.assignmentRoles);
  const assigneeRoles = normalizeList(variant.assigneeRoles);
  const defaultPositions = normalizePositionMap(map);

  if (defaultPositions.length === 0) {
    throw new Error(`No valid positions produced for eventType '${eventType}'`);
  }

  return {
    eventType,
    title,
    allowedRoles,
    assignmentRoles,
    assigneeRoles,
    defaultPositions,
    scheduleDependencies: Array.isArray(variant.scheduleDependencies)
      ? variant.scheduleDependencies
          .map(rule => ({
            eventType: String(rule.eventType || '').trim(),
            offsetMinutes: Number.isFinite(Number(rule.offsetMinutes)) ? Number(rule.offsetMinutes) : 0,
            uniquePer: rule.uniquePer === 'day' ? 'day' : 'slot'
          }))
          .filter(rule => rule.eventType)
      : [],
    isSchedulable: variant.isSchedulable !== false,
    isActive: variant.isActive !== false,
    updatedAt: nowIso
  };
}

function parseArgs(argv) {
  const onlyArg = argv.find(arg => arg.startsWith('--only='));
  const dryRun = argv.includes('--dry-run');
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map(v => v.trim()).filter(Boolean) : null;
  return { dryRun, only };
}

async function run() {
  const { dryRun, only } = parseArgs(process.argv.slice(2));
  const nowIso = new Date().toISOString();

  const variants = only
    ? EVENT_TYPE_VARIANTS.filter(variant => only.includes(variant.eventType))
    : EVENT_TYPE_VARIANTS;

  if (variants.length === 0) {
    throw new Error('No variants selected. Check --only values or EVENT_TYPE_VARIANTS.');
  }

  const collection = db.collection('event_types');
  const results = [];

  for (const variant of variants) {
    const doc = buildEventTypeDoc(variant, nowIso);
    const existing = await collection.findOne({ eventType: doc.eventType });

    if (dryRun) {
      results.push({ eventType: doc.eventType, action: existing ? 'would-update' : 'would-insert', positionCount: doc.defaultPositions.length });
      continue;
    }

    if (existing) {
      await collection.updateOne({ _id: existing._id }, { $set: doc });
      results.push({ eventType: doc.eventType, action: 'updated', positionCount: doc.defaultPositions.length, id: String(existing._id) });
    } else {
      const insertDoc = { ...doc, createdAt: nowIso };
      const inserted = await collection.insertOne(insertDoc);
      results.push({ eventType: doc.eventType, action: 'inserted', positionCount: doc.defaultPositions.length, id: String(inserted.insertedId || '') });
    }
  }

  console.log(JSON.stringify({ dryRun, selected: variants.map(v => v.eventType), results }, null, 2));
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
