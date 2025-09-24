import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sengo = require('sengo');

const sengoClient = new sengo.SengoClient({
  logger: { level: 'debug' },
});

const db = sengoClient.db(process.env.S3_BUCKET || 'deacon-care-system');
export { sengoClient as sengo, db };
