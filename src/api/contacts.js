import { safeCollectionFind, safeCollectionInsert } from '../helpers.js';

export default function registerContactRoutes(app) {
  app.get('/api/contacts', async (c) => {
    try {
      const contacts = await safeCollectionFind('contacts');
      return c.json({ contacts, count: contacts.length });
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return c.json({ error: 'Failed to fetch contacts', message: error.message }, 500);
    }
  });

  app.post('/api/contacts', async (c) => {
    try {
      const body = await c.req.json();
      const requiredFields = ['memberId', 'deaconMemberId', 'contactType', 'summary', 'contactDate'];
      for (const field of requiredFields) {
        if (!body[field]) {
          return c.json({ error: 'Validation failed', message: `Missing required field: ${field}` }, 400);
        }
      }

      const validContactTypes = ['phone', 'visit', 'email', 'text'];
      if (!validContactTypes.includes(body.contactType)) {
        return c.json({ error: 'Validation failed', message: `Invalid contactType. Must be one of: ${validContactTypes.join(', ')}` }, 400);
      }

      const contactData = {
        ...body,
        followUpRequired: body.followUpRequired || false,
        createdAt: new Date().toISOString(),
      };

      const result = await safeCollectionInsert('contacts', contactData);
      return c.json({ message: 'Contact log created successfully', id: result.insertedId, contact: contactData });
    } catch (error) {
      console.error('Error creating contact log:', error);
      return c.json({ error: 'Failed to create contact log', message: error.message }, 500);
    }
  });
}
