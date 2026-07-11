import { db } from '../src/util/sengoClient.js';

/**
 * Reusable position maps. Add new maps here, then reference them from EVENT_TYPE_VARIANTS.
 */
const POSITION_MAPS = {
  lords_supper_standard_16: [
    { positionId: '1-FFL', label: 'Aisle 1 Front Far Left', priority: 1, isCritical: true },
    { positionId: '2-FL', label: 'Aisle 2 Front Left', note: 'Take 2 trays', priority: 2, isCritical: true },
    { positionId: '3-FCL', label: 'Aisle 3 Front Center Left', note: 'Take 2 trays', priority: 3, isCritical: true },
    { positionId: '4-FC', label: 'Aisle 4 Front Center', note: 'Take 2 trays', priority: 4, isCritical: true },
    { positionId: '5-FCR', label: 'Aisle 5 Front Center Right', note: 'Take 2 trays', priority: 5, isCritical: true },
    { positionId: '6-FR', label: 'Aisle 6 Front Right', note: 'Take 2 trays', priority: 6, isCritical: true },
    { positionId: '7-FFR', label: 'Aisle 7 Front Far Right', priority: 7, isCritical: true },
    { positionId: '8-BFL', label: 'Aisle 1 Back Far Left', priority: 8, isCritical: false },
    { positionId: '9-BL', label: 'Aisle 2 Back Left', priority: 9, isCritical: true },
    { positionId: '10-SABL', label: 'Short Aisle Back Left', priority: 10, isCritical: false },
    { positionId: '11-BCL', label: 'Aisle 3 Back Center Left', priority: 11, isCritical: true },
    { positionId: '12-BC', label: 'Aisle 4 Back Center', priority: 12, isCritical: true },
    { positionId: '13-BCR', label: 'Aisle 5 Back Center Right', priority: 13, isCritical: true },
    { positionId: '14-SABR', label: 'Short Aisle Back Right', priority: 14, isCritical: false },
    { positionId: '15-BR', label: 'Aisle 6 Back Right', priority: 15, isCritical: true },
    { positionId: '16-BFR', label: 'Aisle 7 Back Far Right', priority: 16, isCritical: false }
  ],
  lords_supper_full_21: [
    { positionId: '1-FFL', label: 'Aisle 1 Front Far Left', priority: 1, isCritical: true },
    { positionId: '2-FL-A', label: 'Aisle 2 Front Left (A)',  priority: 2, isCritical: true },
    { positionId: '2-FL-B', label: 'Aisle 2 Front Left (B)',  priority: 3, isCritical: true },
    { positionId: '3-FCL-A', label: 'Aisle 3 Front Center Left (A)',  priority: 4, isCritical: true },
    { positionId: '3-FCL-B', label: 'Aisle 3 Front Center Left (B)',  priority: 5, isCritical: true },
    { positionId: '4-FC-A', label: 'Aisle 4 Front Center (A)',  priority: 6, isCritical: true },
    { positionId: '4-FC-B', label: 'Aisle 4 Front Center (B)',  priority: 7, isCritical: true },
    { positionId: '5-FCR-A', label: 'Aisle 5 Front Center Right (A)',  priority: 8, isCritical: true },
    { positionId: '5-FCR-B', label: 'Aisle 5 Front Center Right (B)',  priority: 9, isCritical: true },
    { positionId: '6-FR-A', label: 'Aisle 6 Front Right (A)',  priority: 10, isCritical: true },
    { positionId: '6-FR-B', label: 'Aisle 6 Front Right (B)',  priority: 11, isCritical: true },
    { positionId: '7-FFR', label: 'Aisle 7 Front Far Right', priority: 12, isCritical: true },
    { positionId: '8-BFL', label: 'Aisle 1 Back Far Left', priority: 13, isCritical: false },
    { positionId: '9-BL', label: 'Aisle 2 Back Left', priority: 14, isCritical: true },
    { positionId: '10-SABL', label: 'Short Aisle Back Left', priority: 15, isCritical: false },
    { positionId: '11-BCL', label: 'Aisle 3 Back Center Left', priority: 16, isCritical: true },
    { positionId: '12-BC', label: 'Aisle 4 Back Center', priority: 17, isCritical: true },
    { positionId: '13-BCR', label: 'Aisle 5 Back Center Right', priority: 18, isCritical: true },
    { positionId: '14-SABR', label: 'Short Aisle Back Right', priority: 19, isCritical: false },
    { positionId: '15-BR', label: 'Aisle 6 Back Right', priority: 20, isCritical: true },
    { positionId: '16-BFR', label: 'Aisle 7 Back Far Right', priority: 21, isCritical: false }
  ],
  lords_supper_setup_team: [
    { positionId: 'PREP1', label: 'Preparation Team 1', priority: 1, isCritical: true },
    { positionId: 'PREP2', label: 'Preparation Team 2', priority: 2, isCritical: true },
    { positionId: 'TRAINEE', label: 'Preparation Trainee', priority: 3, isCritical: false }
  ],
  lords_supper_leadership_team: [
    { positionId: 'LEADER', label: 'Event Leader', priority: 1, isCritical: true, allowSelfSignup: false },
    { positionId: 'ASSIST', label: 'Event Assistant', priority: 2, isCritical: false, allowSelfSignup: false }
  ],
  lords_supper_cleanup_team: [
    { positionId: 'CLEAN1', label: 'Cleanup Team 1', priority: 1, isCritical: true },
    { positionId: 'CLEAN2', label: 'Cleanup Team 2', priority: 2, isCritical: true },
    { positionId: 'CLEAN3', label: 'Cleanup Team 3', priority: 3, isCritical: false }
  ]
};

/**
 * Event-type variants to seed.
 * Add new variants by adding objects here and referencing a POSITION_MAPS key.
 */
const EVENT_TYPE_VARIANTS = [
  {
    eventType: 'lords-supper-standard',
    title: "Lord's Supper",
    positionMap: 'lords_supper_standard_16',
    allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon', 'elder', 'usher'],
    quickAddAssigneeRole: 'usher',
    requiredGender: 'male',
    scheduleDependencies: [
      { eventType: 'lords-supper-leadership', offsetMinutes: -30, uniquePer: 'day' },
      { eventType: 'lords-supper-setup', offsetMinutes: -60, uniquePer: 'day' },
      { eventType: 'lords-supper-cleanup', offsetMinutes: 60, uniquePer: 'slot' }
    ],
    isActive: true
  },
  {
    eventType: 'lords-supper-full',
    title: "Lord's Supper (Full 21)",
    positionMap: 'lords_supper_full_21',
    allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon', 'elder', 'usher'],
    quickAddAssigneeRole: 'usher',
    requiredGender: 'male',
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
    allowedRoles: ['deacon', 'elder'],
    assignmentRoles: ['deacon', 'staff', 'elder'],
    assigneeRoles: ['deacon', 'elder'],
    allowQuickAddAssignee: false,
    requiredGender: 'male',
    isSchedulable: false,
    isActive: true
  },
  {
    eventType: 'lords-supper-setup',
    title: "Lord's Supper Setup",
    positionMap: 'lords_supper_setup_team',
    allowedRoles: ['deacon'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon'],
    allowQuickAddAssignee: false,
    isSchedulable: false,
    isActive: true
  },
  {
    eventType: 'lords-supper-cleanup',
    title: "Lord's Supper Cleanup",
    positionMap: 'lords_supper_cleanup_team',
    allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon', 'usher'],
    quickAddAssigneeRole: 'usher',
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
      note: String(position.note || '').trim() || null,
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
  const quickAddAssigneeRole = String(variant.quickAddAssigneeRole || '').trim() || null;
  const allowQuickAddAssignee = variant.allowQuickAddAssignee !== false;
  const requiredGender = ['male', 'female'].includes(String(variant.requiredGender || '').trim().toLowerCase())
    ? String(variant.requiredGender || '').trim().toLowerCase()
    : null;
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
    quickAddAssigneeRole,
    allowQuickAddAssignee,
    requiredGender,
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
