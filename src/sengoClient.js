import { SengoClient, SengoDb } from 'sengo';

export const sengo = new SengoClient({
  logger: { level: 'info' },
});

export const db = sengo.db(process.env.S3_BUCKET || 'deacon-care-system')
