import { db } from './sengoClient.js';
import { getLogger } from './logger.js';

export async function safeCollectionFind(collectionName, query = {}) {
  try {
    const collection = db.collection(collectionName);
    const result = await collection.find(query).toArray();
    return result || [];
  } catch (error) {
    getLogger().error(error, `Error accessing collection ${collectionName}:`);
    return [];
  }
}

export async function safeCollectionInsert(collectionName, data, options = {}) {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const collection = db.collection(collectionName);
      const result = await collection.insertOne(data);
      // Invalidate summary cache for writes to key collections unless caller opts out
      try {
        if (!options.skipCacheInvalidation && ['members', 'contacts', 'assignments', 'households'].includes(collectionName)) {
          await deleteCache('reports_summary');
        }
      } catch (e) {
        getLogger().warn('Failed to invalidate cache after insert', e);
      }
      return result;
    } catch (error) {
      if (error.Code === 'ConditionalRequestConflict' && attempts < maxRetries - 1) {
        getLogger().warn(`Retrying due to conflict (attempt ${attempts + 1})`);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
      } else {
        getLogger().error(error, `Error inserting into collection ${collectionName}:`);
        throw error;
      }
    }
  }
}

export async function safeCollectionUpdate(collectionName, query, update, options = {}) {
  const maxRetries = 3;
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      const collection = db.collection(collectionName);
      const result = await collection.updateOne(query, update);
      // Invalidate summary cache for writes to key collections unless caller opts out
      try {
        if (!options.skipCacheInvalidation && ['members', 'contacts', 'assignments', 'households'].includes(collectionName)) {
          await deleteCache('reports_summary');
        }
      } catch (e) {
        getLogger().warn('Failed to invalidate cache after update', e);
      }
      return result;
    } catch (error) {
      if (error.Code === 'ConditionalRequestConflict' && attempts < maxRetries - 1) {
        getLogger().warn(`Retrying due to conflict (attempt ${attempts + 1})`); 
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
      } else {
        getLogger().error(error, `Error updating collection ${collectionName}:`);
        throw error;
      }
    }
  }
}

// Cache helpers: store small cached JSON documents in a `cache` collection
export async function getCache(key) {
  try {
    const doc = await db.collection('cache').find({ _id: key }).toArray();
    return (doc && doc[0]) || null;
  } catch (error) {
    getLogger().error(error, `Error reading cache key ${key}:`);
    return null;
  }
}

export async function setCache(key, data) {
  try {
    const now = new Date().toISOString();
    // using insert,  It should never exist already, unless another lambda has written 
    // it at the same time.  Both documents are valid, so let the existing one stay.
    const result = await db.collection('cache').insertOne({ _id: key, data, updatedAt: now });
    
    return result;
  } catch (error) {
    getLogger().error(error, `Error setting cache key ${key}:`);
    throw error;
  }
}

export async function deleteCache(key) {
  try {
    const result = await db.collection('cache').deleteOne({ _id: key });
    return result;
  } catch (error) {
    getLogger().error(error, `Error deleting cache key ${key}:`);
    throw error;
  }
}

export async function validatePhoneRequirement(householdId, excludeMemberId = null) {
  try {
    // Get household data
    const households = await safeCollectionFind('households', { _id: householdId });
    const household = households[0];
    
    // If household has a phone, we're good
    if (household && household.primaryPhone) {
      return true;
    }
    
    // Check if any member has a phone
    const members = await safeCollectionFind('members', { householdId });
    const membersWithPhone = members.filter(member => 
      member.phone && member._id !== excludeMemberId
    );
    
    return membersWithPhone.length > 0;
  } catch (error) {
    getLogger().error(error, 'Error validating phone requirement:');
    return false;
  }
}
