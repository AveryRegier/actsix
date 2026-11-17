import { afterEach, describe, expect, test, vi } from 'vitest';

const collection = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn()
}));

vi.mock('../src/util/sengoClient.js', () => ({
  db: { collection: vi.fn(() => collection) }
}));

describe('ballot collection event type seed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test.each([
    ['insert', null],
    ['update', { _id: 'existing-id' }]
  ])('%s creates the same ballot collection configuration', async (action, existing) => {
    collection.findOne.mockReset().mockResolvedValue(existing);
    collection.insertOne.mockReset().mockResolvedValue({ insertedId: 'new-id' });
    collection.updateOne.mockReset().mockResolvedValue({ matchedCount: 1 });
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'seed-event-types.js', '--only=ballot-collection']);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await import('../scripts/seed-event-types.js');
    await vi.waitFor(() => expect(log).toHaveBeenCalled());

    expect(collection.findOne).toHaveBeenCalledWith({ eventType: 'ballot-collection' });
    const doc = action === 'insert'
      ? collection.insertOne.mock.calls[0][0]
      : collection.updateOne.mock.calls[0][1].$set;
    if (action === 'update') {
      expect(collection.updateOne).toHaveBeenCalledWith({ _id: 'existing-id' }, { $set: doc });
    }
    expect(doc).toMatchObject({
      eventType: 'ballot-collection',
      title: 'Ballot Collection',
      allowedRoles: ['deacon', 'staff', 'elder', 'usher', 'admin'],
      assignmentRoles: ['deacon', 'staff'],
      assigneeRoles: ['deacon', 'elder', 'usher'],
      quickAddAssigneeRole: 'usher',
      requiredGender: null,
      isSchedulable: true,
      isActive: true,
      scheduleDependencies: []
    });
    expect(doc.defaultPositions).toHaveLength(10);
    expect(doc.defaultPositions).toEqual(Array.from({ length: 10 }, (_, index) => ({
      positionId: `BALLOT${index + 1}`,
      label: `Ballot Collector ${index + 1}`,
      note: null,
      priority: index + 1,
      isCritical: true,
      allowSelfSignup: true
    })));
    const result = JSON.parse(log.mock.calls[0][0]);
    expect(result.results[0]).toMatchObject({
      eventType: 'ballot-collection',
      action: action === 'insert' ? 'inserted' : 'updated',
      positionCount: 10
    });
  });
});
