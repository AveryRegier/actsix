#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { db, sengo } from '../src/util/sengoClient.js';

const collectionName = 'event_signups';
const indexKeys = { calendarId: 1, memberId: 1 };
const indexName = 'calendarId_1_memberId_1';
const bucketName = process.env.S3_BUCKET || 'deacon-care-system';
const signupCollection = db.collection(collectionName);

function parseArgs(argv) {
  const [command = 'report', ...args] = argv;
  const options = { command, apply: args.includes('--apply'), allowDeleteAssigned: args.includes('--allow-delete-assigned') };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file') options.file = args[++i];
    if (args[i] === '--confirm-bucket') options.confirmBucket = args[++i];
  }

  return options;
}

function normalizedId(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function signupLabel(signup) {
  return {
    id: normalizedId(signup._id),
    calendarId: normalizedId(signup.calendarId),
    eventId: normalizedId(signup.eventId),
    memberId: normalizedId(signup.memberId),
    isAvailable: signup.isAvailable === true,
    assignedPositionId: normalizedId(signup.assignedPositionId),
    createdAt: signup.createdAt || null,
    updatedAt: signup.updatedAt || null
  };
}

async function loadSnapshot() {
  const [signups, calendarSlots, indexes] = await Promise.all([
    signupCollection.find({}).toArray(),
    db.collection('event_calendar').find({}).toArray(),
    signupCollection.listIndexes()
  ]);
  const calendarById = new Map(calendarSlots.map(slot => [normalizedId(slot._id), slot]));
  const calendarIds = new Set(Array.from(calendarById.keys()).filter(Boolean));
  return { signups, calendarIds, calendarById, indexes };
}

function analyzeSnapshot(snapshot) {
  const groups = new Map();
  const legacyCalendarIdCandidates = [];
  const unresolved = [];

  for (const signup of snapshot.signups) {
    let calendarId = normalizedId(signup.calendarId);
    const memberId = normalizedId(signup.memberId);
    const eventId = normalizedId(signup.eventId);
    let inferredCalendarId = false;

    if (!calendarId && eventId && snapshot.calendarIds.has(eventId)) {
      calendarId = eventId;
      inferredCalendarId = true;
      legacyCalendarIdCandidates.push(signupLabel(signup));
    }

    if (!calendarId || !memberId) {
      unresolved.push({
        ...signupLabel(signup),
        inferredCalendarId: inferredCalendarId ? calendarId : null,
        missing: [!calendarId ? 'calendarId' : null, !memberId ? 'memberId' : null].filter(Boolean)
      });
      continue;
    }

    const key = JSON.stringify([calendarId, memberId]);
    if (!groups.has(key)) groups.set(key, { calendarId, memberId, signups: [] });
    groups.get(key).signups.push({ ...signup, inferredCalendarId });
  }

  const duplicateGroups = Array.from(groups.values())
    .filter(group => group.signups.length > 1)
    .map(group => ({
      calendarId: group.calendarId,
      memberId: group.memberId,
      serviceDate: snapshot.calendarById.get(group.calendarId)?.serviceDate || null,
      signups: group.signups.map(signup => ({
        ...signupLabel(signup),
        inferredCalendarId: signup.inferredCalendarId ? group.calendarId : null
      }))
    }));

  return { groups, duplicateGroups, legacyCalendarIdCandidates, unresolved };
}

function matchingIndex(indexes) {
  return indexes.find(index => {
    const entries = Object.entries(index.key || {});
    return entries.length === 2
      && entries[0][0] === 'calendarId' && entries[0][1] === 1
      && entries[1][0] === 'memberId' && entries[1][1] === 1;
  }) || null;
}

function printReport(snapshot, analysis) {
  const existingIndex = matchingIndex(snapshot.indexes);
  console.log(JSON.stringify({
    bucket: bucketName,
    collection: collectionName,
    documentCount: snapshot.signups.length,
    targetIndex: { name: indexName, key: indexKeys, existing: existingIndex },
    duplicateGroups: analysis.duplicateGroups,
    legacyCalendarIdCandidates: analysis.legacyCalendarIdCandidates,
    unresolvedDocuments: analysis.unresolved
  }, null, 2));
}

function requireWriteConfirmation(options) {
  if (!options.apply) throw new Error('Write operation requires --apply.');
  if (options.confirmBucket !== bucketName) {
    throw new Error(`Write operation requires --confirm-bucket ${bucketName}; current target is ${bucketName}.`);
  }
}

function buildPastDuplicateCleanupPlan(snapshot, analysis) {
  const today = new Date().toISOString().slice(0, 10);
  const plans = [];
  const skippedGroups = [];

  for (const duplicateGroup of analysis.duplicateGroups) {
    const serviceDate = duplicateGroup.serviceDate;
    if (!serviceDate || serviceDate >= today) {
      skippedGroups.push({
        calendarId: duplicateGroup.calendarId,
        memberId: duplicateGroup.memberId,
        serviceDate,
        reason: serviceDate ? 'not before today' : 'calendar date unavailable'
      });
      continue;
    }

    const group = analysis.groups.get(JSON.stringify([duplicateGroup.calendarId, duplicateGroup.memberId]));
    const ranked = [...group.signups].sort((left, right) => {
      const assignedDifference = Number(Boolean(right.assignedPositionId)) - Number(Boolean(left.assignedPositionId));
      if (assignedDifference !== 0) return assignedDifference;

      const updatedDifference = Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0);
      if (Number.isFinite(updatedDifference) && updatedDifference !== 0) return updatedDifference;
      return normalizedId(left._id).localeCompare(normalizedId(right._id));
    });

    const keep = ranked[0];
    plans.push({
      calendarId: duplicateGroup.calendarId,
      memberId: duplicateGroup.memberId,
      serviceDate,
      keepId: normalizedId(keep._id),
      deleteIds: ranked.slice(1).map(signup => normalizedId(signup._id)),
      assignedDeleteIds: ranked.slice(1)
        .filter(signup => normalizedId(signup.assignedPositionId))
        .map(signup => normalizedId(signup._id))
    });
  }

  return { today, plans, skippedGroups };
}

async function cleanPastDuplicates(options, snapshot, analysis) {
  const { today, plans, skippedGroups } = buildPastDuplicateCleanupPlan(snapshot, analysis);
  console.log(JSON.stringify({
    bucket: bucketName,
    today,
    groupsToClean: plans.length,
    duplicateRowsToDelete: plans.reduce((count, plan) => count + plan.deleteIds.length, 0),
    assignedRowsAmongDeletes: plans.reduce((count, plan) => count + plan.assignedDeleteIds.length, 0),
    plans,
    skippedGroups
  }, null, 2));

  if (!options.apply) {
    console.log('Dry run only. Re-run with --apply --confirm-bucket <bucket> to keep one row and delete duplicate rows for past events.');
    return;
  }
  requireWriteConfirmation(options);

  for (const plan of plans) {
    for (const id of plan.deleteIds) {
      const result = await signupCollection.deleteOne({ _id: id });
      if (result.deletedCount > 1) throw new Error(`Delete for signup ${id} reported deletedCount ${result.deletedCount}.`);
    }
    await signupCollection.updateOne(
      { _id: plan.keepId },
      { $set: { calendarId: plan.calendarId, memberId: plan.memberId } }
    );
  }

  console.log(`Cleaned ${plans.length} past duplicate group(s). Re-run report to inspect remaining duplicates and unresolved rows.`);
}

async function normalizeLegacy(options, snapshot) {
  const analysis = analyzeSnapshot(snapshot);
  const candidates = analysis.legacyCalendarIdCandidates.filter(row => row.memberId);
  if (matchingIndex(snapshot.indexes)?.unique === true && candidates.length > 0) {
    throw new Error('A unique signup index already exists. Do not normalize legacy rows automatically; review them manually.');
  }
  console.log(`Legacy rows whose eventId exactly matches an event_calendar _id: ${candidates.length}`);
  console.log(JSON.stringify(candidates, null, 2));

  if (!options.apply) {
    console.log('Dry run only. Re-run with --apply --confirm-bucket <bucket> to add calendarId to these rows.');
    return;
  }
  requireWriteConfirmation(options);

  for (const row of candidates) {
    await signupCollection.updateOne(
      { _id: row.id },
      { $set: { calendarId: row.eventId } }
    );
  }
  console.log(`Updated ${candidates.length} legacy signup row(s). Run report again before resolving duplicates.`);
}

async function readResolutions(file) {
  if (!file) throw new Error('resolve requires --file <resolution.json>.');
  const parsed = JSON.parse(await readFile(file, 'utf8'));
  const resolutions = Array.isArray(parsed) ? parsed : parsed.resolutions;
  if (!Array.isArray(resolutions)) throw new Error('Resolution file must be an array or contain a resolutions array.');
  return resolutions;
}

function validateResolutions(resolutions, snapshot) {
  const docsById = new Map(snapshot.signups.map(signup => [normalizedId(signup._id), signup]));
  const claimedIds = new Set();
  const keys = new Set();

  for (const resolution of resolutions) {
    const calendarId = normalizedId(resolution.calendarId);
    const memberId = normalizedId(resolution.memberId);
    const keepId = normalizedId(resolution.keepId);
    const deleteIds = Array.isArray(resolution.deleteIds) ? resolution.deleteIds.map(normalizedId) : null;
    if (!calendarId || !memberId || !keepId || !deleteIds) {
      throw new Error('Each resolution needs calendarId, memberId, keepId, and deleteIds.');
    }
    if (deleteIds.includes(keepId) || new Set(deleteIds).size !== deleteIds.length) {
      throw new Error(`Resolution for ${calendarId}/${memberId} has duplicate or conflicting IDs.`);
    }

    const key = JSON.stringify([calendarId, memberId]);
    if (keys.has(key)) throw new Error(`Duplicate resolution for ${calendarId}/${memberId}.`);
    keys.add(key);

    for (const id of [keepId, ...deleteIds]) {
      if (!id) throw new Error('Resolution contains a missing document ID.');
      if (claimedIds.has(id)) throw new Error(`Signup document ${id} appears in multiple resolutions.`);
      claimedIds.add(id);
      if (id !== keepId && !docsById.has(id)) continue;
      if (!docsById.has(id)) throw new Error(`Signup document ${id} not found.`);

      const doc = docsById.get(id);
      const existingCalendarId = normalizedId(doc.calendarId);
      const existingMemberId = normalizedId(doc.memberId);
      if (existingCalendarId && existingCalendarId !== calendarId) {
        throw new Error(`Signup ${id} already belongs to calendar ${existingCalendarId}, not ${calendarId}.`);
      }
      if (existingMemberId && existingMemberId !== memberId) {
        throw new Error(`Signup ${id} already belongs to member ${existingMemberId}, not ${memberId}.`);
      }
      if (!existingCalendarId && normalizedId(doc.eventId) && snapshot.calendarIds.has(normalizedId(doc.eventId))
        && normalizedId(doc.eventId) !== calendarId) {
        throw new Error(`Legacy signup ${id} maps to calendar ${doc.eventId}, not ${calendarId}.`);
      }
    }

    const selectedIds = new Set([keepId, ...deleteIds]);
    const knownGroup = analyzeSnapshot(snapshot).groups.get(key);
    if (knownGroup && knownGroup.signups.some(signup => !selectedIds.has(normalizedId(signup._id)))) {
      throw new Error(`Resolution for ${calendarId}/${memberId} omits one or more matching signup documents.`);
    }
  }

  return docsById;
}

async function resolveDuplicates(options, snapshot) {
  const resolutions = await readResolutions(options.file);
  const docsById = validateResolutions(resolutions, snapshot);
  const assignedDeletes = resolutions.flatMap(resolution => resolution.deleteIds)
    .map(normalizedId)
    .filter(id => normalizedId(docsById.get(id)?.assignedPositionId));

  console.log(`Resolutions: ${resolutions.length}; documents to delete: ${resolutions.reduce((count, item) => count + item.deleteIds.length, 0)}; assigned documents among deletes: ${assignedDeletes.length}`);
  if (assignedDeletes.length > 0 && !options.allowDeleteAssigned) {
    throw new Error(`Refusing to delete assigned signup(s) ${assignedDeletes.join(', ')}. Review which assignment to retain, or pass --allow-delete-assigned after explicit review.`);
  }
  if (!options.apply) {
    console.log('Dry run only. Re-run with --apply --confirm-bucket <bucket> to apply these explicit resolutions.');
    return;
  }
  requireWriteConfirmation(options);

  for (const resolution of resolutions) {
    for (const id of resolution.deleteIds) {
      const result = await signupCollection.deleteOne({ _id: normalizedId(id) });
      if (result.deletedCount > 1) throw new Error(`Delete for signup ${id} reported deletedCount ${result.deletedCount}.`);
    }
    await signupCollection.updateOne(
      { _id: normalizedId(resolution.keepId) },
      { $set: { calendarId: normalizedId(resolution.calendarId), memberId: normalizedId(resolution.memberId) } }
    );
  }
  console.log('Resolutions applied. Run report again and verify all retained assignments before creating the index.');
}

async function createUniqueIndex(options, snapshot) {
  const analysis = analyzeSnapshot(snapshot);
  if (analysis.duplicateGroups.length || analysis.unresolved.length) {
    throw new Error(`Index not created: ${analysis.duplicateGroups.length} duplicate group(s) and ${analysis.unresolved.length} unresolved row(s) remain. Run report and resolve them first.`);
  }
  if (!options.apply) {
    console.log(`Dry run: would create unique index ${indexName} on ${collectionName}.`);
    console.log('Re-run with --apply --confirm-bucket <bucket> after pausing signup writes.');
    return;
  }
  requireWriteConfirmation(options);

  const existing = matchingIndex(snapshot.indexes);
  if (existing?.unique === true) {
    console.log(`Unique index ${indexName} already exists.`);
    return;
  }
  if (existing && existing.name !== indexName) {
    throw new Error(`Matching index has unexpected name ${existing.name}; inspect indexes manually.`);
  }

  let droppedExisting = false;
  if (existing) {
    await signupCollection.dropIndex(existing.name);
    droppedExisting = true;
  }

  try {
    await signupCollection.createIndex(indexKeys, { unique: true });
  } catch (error) {
    if (droppedExisting) {
      try {
        await signupCollection.createIndex(indexKeys);
        console.error('Unique index build failed; restored the previous non-unique index.');
      } catch (restoreError) {
        console.error(`Could not restore the previous index: ${restoreError.message}`);
      }
    }
    throw error;
  }

  const created = matchingIndex(await signupCollection.listIndexes());
  if (created?.unique !== true) throw new Error('Index creation returned without unique metadata; verify S3 index metadata before resuming writes.');
  console.log(`Created unique index ${indexName}. Restart or redeploy all app processes so they load the unique index metadata.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = await loadSnapshot();
  const analysis = analyzeSnapshot(snapshot);

  switch (options.command) {
    case 'report':
      printReport(snapshot, analysis);
      break;
    case 'normalize-legacy':
      await normalizeLegacy(options, snapshot);
      break;
    case 'resolve':
      await resolveDuplicates(options, snapshot);
      break;
    case 'clean-past-duplicates':
      await cleanPastDuplicates(options, snapshot, analysis);
      break;
    case 'create-index':
      await createUniqueIndex(options, snapshot);
      break;
    default:
      throw new Error('Usage: node scripts/event-signups-index.js <report|normalize-legacy|clean-past-duplicates|resolve|create-index> [--apply --confirm-bucket <bucket>] [--file <json>] [--allow-delete-assigned]');
  }
}

main()
  .catch(error => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof sengo.close === 'function') await sengo.close();
  });