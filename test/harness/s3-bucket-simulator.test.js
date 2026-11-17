import { describe, expect, it } from 'vitest';
import { S3BucketSimulator } from './s3-bucket-simulator.js';

describe('S3BucketSimulator conditional writes', () => {
  it('rejects IfNoneMatch writes when key already exists', () => {
    const simulator = new S3BucketSimulator();
    simulator.putObject({ Key: 'docs/one.json', Body: '{"value":1}' });

    expect(() => simulator.putObject({
      Key: 'docs/one.json',
      Body: '{"value":2}',
      IfNoneMatch: '*',
    })).toThrowError(expect.objectContaining({
      name: 'PreconditionFailed',
      Code: 'PreconditionFailed',
      $metadata: { httpStatusCode: 412 },
    }));
    expect(simulator.files.get('docs/one.json')).toBe('{"value":1}');
  });

  it('requires matching ETag for IfMatch writes', () => {
    const simulator = new S3BucketSimulator();
    const initial = simulator.putObject({ Key: 'docs/one.json', Body: '{"value":1}' });

    expect(() => simulator.putObject({
      Key: 'docs/one.json',
      Body: '{"value":2}',
      IfMatch: 'stale-etag',
    })).toThrowError(expect.objectContaining({ name: 'PreconditionFailed' }));

    expect(simulator.putObject({
      Key: 'docs/one.json',
      Body: '{"value":2}',
      IfMatch: initial.ETag,
    }).ETag).toBeTruthy();
  });
});