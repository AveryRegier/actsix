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

export async function safeCollectionInsert(collectionName, data) {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const collection = db.collection(collectionName);
      const result = await collection.insertOne(data);
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

export async function safeCollectionUpdate(collectionName, query, update) {
  const maxRetries = 3;
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      const collection = db.collection(collectionName);
      const result = await collection.updateOne(query, update);
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
