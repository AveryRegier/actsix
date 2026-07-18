import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sengo = require('sengo');

const sengoClient = new sengo.SengoClient({
  logger: { level: 'debug' },
});

const db = sengoClient.db(process.env.S3_BUCKET || 'deacon-care-system');

if (process.env.USE_S3_SIMULATOR === '1') {
  console.log('[sengoClient] Initialized with S3_BUCKET:', process.env.S3_BUCKET, '(simulator mode)');
} else {
  console.log('[sengoClient] Initialized with S3_BUCKET:', process.env.S3_BUCKET, '(REAL AWS)');
}

export { sengoClient as sengo, db };
