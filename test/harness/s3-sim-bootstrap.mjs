import { createRequire } from 'module';
import path from 'path';
import { S3BucketSimulator } from './s3-bucket-simulator.js';

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

const simulator = new S3BucketSimulator();
const originalSend = awsS3.S3Client.prototype.send;

awsS3.S3Client.prototype.send = function patchedSend(command, ...args) {
  if (process.env.USE_S3_SIMULATOR !== '1') {
    return originalSend.call(this, command, ...args);
  }

  return simulator.handleCommand(command);
};

globalThis.__ACTSIX_S3SIM__ = simulator;
