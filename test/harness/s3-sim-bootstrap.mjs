import { createRequire } from 'module';
import path from 'path';
import { S3BucketSimulator } from './s3-bucket-simulator.js';
import { appendMailboxMessage } from './fake-mailbox.js';

const require = createRequire(import.meta.url);

function loadAwsS3Module() {
  try {
    return require('@aws-sdk/client-s3');
  } catch {
    const siblingPath = path.join(process.cwd(), '..', 'sengo', 'node_modules', '@aws-sdk', 'client-s3');
    return require(siblingPath);
  }
}

const awsS3 = loadAwsS3Module();

function patchMailer() {
  if (process.env.USE_FAKE_MAILER !== '1') {
    console.log('[s3-sim-bootstrap] USE_FAKE_MAILER not set, skipping mailer patch');
    return;
  }

  console.log('[s3-sim-bootstrap] Patching nodemailer with fake mailer');
  const nodemailer = require('nodemailer');
  const originalCreateTransport = nodemailer.createTransport;

  nodemailer.createTransport = function fakeCreateTransport() {
    console.log('[s3-sim-bootstrap] fakeCreateTransport called');
    return {
      sendMail: async (mailOptions = {}) => {
        console.log('[s3-sim-bootstrap] Fake sendMail called with:', { to: mailOptions.to, subject: mailOptions.subject });
        try {
          appendMailboxMessage({
            to: mailOptions.to,
            from: mailOptions.from,
            subject: mailOptions.subject,
            text: mailOptions.text,
            html: mailOptions.html,
            headers: mailOptions.headers,
          });
          console.log('[s3-sim-bootstrap] Email appended to mailbox successfully');
        } catch (err) {
          console.log('[s3-sim-bootstrap] Error appending to mailbox:', err);
          throw err;
        }
        return { messageId: `fake-${Date.now()}` };
      },
    };
  };

  nodemailer.__originalCreateTransport = originalCreateTransport;
  console.log('[s3-sim-bootstrap] Mailer patching complete');
}

const simulator = new S3BucketSimulator();
const originalSend = awsS3.S3Client.prototype.send;

console.log('[s3-sim-bootstrap] S3Client.prototype.send:', typeof originalSend);
console.log('[s3-sim-bootstrap] USE_S3_SIMULATOR:', process.env.USE_S3_SIMULATOR);
console.log('[s3-sim-bootstrap] USE_FAKE_MAILER:', process.env.USE_FAKE_MAILER);

patchMailer();

awsS3.S3Client.prototype.send = function patchedSend(command, ...args) {
  const commandType = command?.constructor?.name || 'Unknown';
  if (process.env.USE_S3_SIMULATOR !== '1') {
    console.log('[s3-sim-bootstrap] Bypassing simulator (USE_S3_SIMULATOR not set), using real AWS for:', commandType);
    return originalSend.call(this, command, ...args);
  }

  console.log('[s3-sim-bootstrap] Routing S3 command to simulator:', commandType);
  return simulator.handleCommand(command);
};

console.log('[s3-sim-bootstrap] S3 simulator patch complete');

globalThis.__ACTSIX_S3SIM__ = simulator;

async function initializeSimulatorIndexes() {
  if (process.env.USE_S3_SIMULATOR !== '1') return;

  const { SengoClient } = require('sengo');
  const client = new SengoClient({ logger: { level: 'error' } });
  const db = client.db(process.env.S3_BUCKET || 'deacon-care-system-e2e');
  const indexesByCollection = {
    members: [
      { keys: { email: 1 } },
      { keys: { householdId: 1 } },
      { keys: { tag: 1 } },
      { keys: { tags: 1 } },
    ],
    households: [],
    assignments: [
      { keys: { deaconMemberId: 1 } },
      { keys: { householdId: 1 } },
    ],
    contacts: [
      { keys: { memberId: 1, contactDate: 1 } },
    ],
    event_types: [
      { keys: { eventType: 1 } },
      { keys: { isActive: 1 } },
    ],
    event_calendar: [
      { keys: { date: 1 } },
      { keys: { eventType: 1, serviceDate: 1 } },
    ],
    event_signups: [
      { keys: { calendarId: 1 } },
      { keys: { calendarId: 1, assignedPositionId: 1 } },
      { keys: { calendarId: 1, memberId: 1 }, options: { unique: true } },
      { keys: { eventId: 1, assignedPositionId: 1 } },
      { keys: { memberId: 1 } },
    ],
  };

  try {
    for (const [collectionName, definitions] of Object.entries(indexesByCollection)) {
      const collection = db.collection(collectionName);
      for (const definition of definitions) {
        await collection.createIndex(definition.keys, definition.options);
      }

      const actualIndexes = await collection.listIndexes();
      for (const definition of definitions) {
        const expectedName = Object.entries(definition.keys)
          .map(([field, order]) => `${field}_${order}`)
          .join('_');
        const actual = actualIndexes.find(index => index.name === expectedName);
        const actualUnique = actual?.unique === true;
        const expectedUnique = definition.options?.unique === true;
        if (!actual || actualUnique !== expectedUnique) {
          throw new Error(`Simulator index verification failed for ${collectionName}.${expectedName}`);
        }
      }
    }

    const signups = db.collection('event_signups');
    const probeId = `__e2e_unique_index_probe_${process.pid}_${Date.now()}`;
    const probeCalendarId = `${probeId}_calendar`;
    const probeMemberId = `${probeId}_member`;
    let duplicateRejected = false;
    await signups.insertOne({ _id: `${probeId}_first`, calendarId: probeCalendarId, memberId: probeMemberId });
    try {
      await signups.insertOne({ _id: `${probeId}_duplicate`, calendarId: probeCalendarId, memberId: probeMemberId });
    } catch (error) {
      if (error?.name !== 'DuplicateKeyError') throw error;
      duplicateRejected = true;
    } finally {
      await signups.deleteOne({ _id: `${probeId}_first` });
      await signups.deleteOne({ _id: `${probeId}_duplicate` });
    }
    if (!duplicateRejected) throw new Error('Simulator unique signup index accepted a duplicate calendarId/memberId pair');

    console.log('[s3-sim-bootstrap] Production-shaped indexes initialized, including unique event_signups(calendarId, memberId)');
  } finally {
    await client.close();
  }
}

await initializeSimulatorIndexes();
