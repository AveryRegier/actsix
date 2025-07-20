import { safeCollectionFind, safeCollectionInsert } from '../helpers.js';

export default function registerHouseholdRoutes(app) {
  app.get('/api/households', async (c) => {
    try {
      const households = await safeCollectionFind('households');
      return c.json({ households, count: households.length });
    } catch (error) {
      console.error('Error fetching households:', error);
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

        const requiredAddressFields = ['street', 'city', 'state', 'zipCode'];
        for (const field of requiredAddressFields) {
          if (!body.address[field]) {
            return c.json({ error: 'Validation failed', message: `Missing required address field: ${field}` }, 400);
          }
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
      console.error('Error creating household:', error);
      return c.json({ error: 'Failed to create household', message: error.message }, 500);
    }
  });
}
