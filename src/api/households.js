import { getLogger } from '../logger.js';
import { db, safeCollectionFind, safeCollectionInsert } from '../helpers.js';
import { verifyRole } from '../auth.js';

function validateAddress(address) {
    if (address.street && typeof address.street !== 'string') {
        return { error: 'Validation failed', message: 'Street must be a string' };
    }
    if (address.city && typeof address.city !== 'string') {
        return { error: 'Validation failed', message: 'City must be a string' };
    }
    if (address.state && typeof address.state !== 'string') {
        return { error: 'Validation failed', message: 'State must be a string' };
    }
    if (address.zipCode && !/^[0-9]{5}(?:-[0-9]{4})?$/.test(address.zipCode)) {
        return { error: 'Validation failed', message: 'Zip Code must be a valid US zip code' };
    }
    return null;
}

export default function registerHouseholdRoutes(app) {
  app.get('/api/households', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const households = await safeCollectionFind('households');
      return c.json({ households, count: households.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching households:');
      return c.json({ error: 'Failed to fetch households', message: error.message }, 500);
    }
  });

  app.get('/api/households/:householdId', async (c) => {
    let householdId = c.req.param('householdId');
    if (!verifyRole(c, ['deacon', 'staff'])) {
      const members = await safeCollectionFind('members', { _id: c.req.memberId }) || [];
      if(!members.map(m=>m.householdId).includes(householdId)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }
    }
    try {
      const household = await safeCollectionFind('households', { _id: householdId });
      return c.json(household[0] || { error: 'Household not found' });
    } catch (error) {
      getLogger().error(error, 'Error fetching households:');
      return c.json({ error: 'Failed to fetch households', message: error.message }, 500);
    }
  });

  app.post('/api/households', async (c) => {
    try {
      const body = await c.req.json();
      const requiredFields = ['lastName'];
      for (const field of requiredFields) {
        if (!body[field]) {
          return c.json({ error: 'Validation failed', message: `Missing required field: ${field}` }, 400);
        }
      }

      if (body.address) {
        if (typeof body.address !== 'object') {
          return c.json({ error: 'Validation failed', message: 'Address must be an object' }, 400);
        }

        const addressValidationError = validateAddress(body.address);
        if (addressValidationError) {
          return c.json(addressValidationError, 400);
        }
      }

      const householdData = {
        ...body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await safeCollectionInsert('households', householdData);
      return c.json({ message: 'Household created successfully', id: result.insertedId, household: householdData });
    } catch (error) {
      getLogger().error(error, 'Error creating household:');
      return c.json({ error: 'Failed to create household', message: error.message }, 500);
    }
  });

  app.patch('/api/households/:householdId', async (c) => {
    let householdId = c.req.param('householdId');
    if (!verifyRole(c, ['deacon', 'staff'])) {
      const members = await safeCollectionFind('members', { _id: c.req.memberId }) || [];
      if(!members.map(m=>m.householdId).includes(householdId)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }
    }
    const body = await c.req.json();

    // Validate required fields
    if (!body.lastName) {
        return c.json({ error: 'Validation failed', message: 'Last name is required' }, 400);
    }

    // Validate address fields
    const address = body.address || {};
    if (address.street && typeof address.street !== 'string') {
        return c.json({ error: 'Validation failed', message: 'Street must be a string' }, 400);
    }
    if (address.city && typeof address.city !== 'string') {
        return c.json({ error: 'Validation failed', message: 'City must be a string' }, 400);
    }
    if (address.state && typeof address.state !== 'string') {
        return c.json({ error: 'Validation failed', message: 'State must be a string' }, 400);
    }
    if (address.zipCode && !/^[0-9]{5}(?:-[0-9]{4})?$/.test(address.zipCode)) {
        return c.json({ error: 'Validation failed', message: 'Zip Code must be a valid US zip code' }, 400);
    }

    try {
        const updateData = {
            lastName: body.lastName,
            address: {
                street: address.street || '',
                city: address.city || '',
                state: address.state || '',
                zipCode: address.zipCode || ''
            },
            primaryPhone: body.primaryPhone || '',
            email: body.email || '',
            notes: body.notes || ''
        };

        const result = await db.collection('households').updateOne({ _id: householdId }, { $set: updateData });

        if (result.modifiedCount > 0) {
            return c.json({ message: 'Household updated successfully', householdId });
        } else {
            return c.json({ error: 'Update failed', message: 'No changes made to the household' }, 400);
        }
    } catch (error) {
        getLogger().error(error, 'Error updating household:');
        return c.json({ error: 'Failed to update household', message: error.message }, 500);
    }
});
}
