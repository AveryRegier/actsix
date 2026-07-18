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
