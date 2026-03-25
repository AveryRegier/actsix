import { db } from '../../src/util/sengoClient.js';

export async function clearCollections(collectionNames = []) {
  for (const collectionName of collectionNames) {
    const docs = await db.collection(collectionName).find({}).toArray();
    for (const doc of docs) {
      await db.collection(collectionName).deleteOne({ _id: doc._id });
    }
  }
}

export async function seedCommonLocations() {
  const now = new Date().toISOString();
  await db.collection('common_locations').insertOne({
    name: 'Mercy West',
    type: 'hospital',
    address: { street: '100 Main St', city: 'Des Moines', state: 'IA', zipCode: '50309' },
    phone: '515-555-1111',
    website: '',
    visitingHours: '9am-5pm',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}
