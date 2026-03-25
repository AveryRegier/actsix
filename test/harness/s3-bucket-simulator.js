import { Readable } from 'stream';
import crypto from 'crypto';

function toBodyString(body) {
  if (body == null) {
    return '';
  }

  if (typeof body === 'string') {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return body.toString('utf8');
  }

  if (typeof body === 'object' && typeof body.transformToString === 'function') {
    return body.transformToString();
  }

  return String(body);
}

export class S3BucketSimulator {
  constructor() {
    this.files = new Map();
    this.etags = new Map();
    this.conflictPrefixes = (process.env.S3SIM_CONFLICT_PREFIXES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.conflictBudget = Number(process.env.S3SIM_CONFLICT_COUNT || 0);
  }

  makeEtag() {
    return crypto.randomUUID();
  }

  shouldConflict(key) {
    if (this.conflictBudget < 1) {
      return false;
    }

    if (this.conflictPrefixes.length === 0) {
      this.conflictBudget -= 1;
      return true;
    }

    const matched = this.conflictPrefixes.some((prefix) => key.startsWith(prefix));
    if (matched) {
      this.conflictBudget -= 1;
    }
    return matched;
  }

  putObject({ Key, Body }) {
    if (!Key) {
      throw new Error('Missing Key for putObject');
    }

    if (this.shouldConflict(Key)) {
      const err = new Error('ConditionalRequestConflict');
      err.Code = 'ConditionalRequestConflict';
      throw err;
    }

    const text = toBodyString(Body);
    this.files.set(Key, text);
    const etag = this.makeEtag();
    this.etags.set(Key, etag);
    return { ETag: etag };
  }

  getObject({ Key }) {
    if (!this.files.has(Key)) {
      const err = new Error('NoSuchKey');
      err.name = 'NoSuchKey';
      throw err;
    }

    const value = this.files.get(Key);
    return {
      Body: Readable.from([value]),
      ETag: this.etags.get(Key),
    };
  }

  headObject({ Key }) {
    if (!this.files.has(Key)) {
      const err = new Error('NoSuchKey');
      err.name = 'NoSuchKey';
      throw err;
    }

    const value = this.files.get(Key);
    return {
      ContentLength: value.length,
      ETag: this.etags.get(Key),
    };
  }

  deleteObject({ Key }) {
    const existed = this.files.delete(Key);
    this.etags.delete(Key);
    return { DeleteMarker: existed };
  }

  listObjectsV2({ Prefix = '' }) {
    const contents = [];
    for (const key of this.files.keys()) {
      if (!Prefix || key.startsWith(Prefix)) {
        contents.push({ Key: key, ETag: this.etags.get(key) });
      }
    }
    return { Contents: contents };
  }

  async handleCommand(command) {
    const type = command?.constructor?.name;
    const input = command?.input || {};

    switch (type) {
      case 'PutObjectCommand':
        return this.putObject(input);
      case 'GetObjectCommand':
        return this.getObject(input);
      case 'HeadObjectCommand':
        return this.headObject(input);
      case 'DeleteObjectCommand':
        return this.deleteObject(input);
      case 'ListObjectsV2Command':
        return this.listObjectsV2(input);
      case 'CreateBucketCommand':
        return {};
      default:
        throw new Error(`Unsupported S3 command for simulator: ${type}`);
    }
  }
}
