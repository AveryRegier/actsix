import { getLogger } from '../logger.js';
import { safeCollectionFind, safeCollectionInsert } from '../helpers.js';

export default function registerContactRoutes(app) {
  app.get('/api/contacts', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon' && role !== 'staff') {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const contacts = await safeCollectionFind('contacts');
      return c.json({ contacts, count: contacts.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching contacts:');
      return c.json({ error: 'Failed to fetch contacts', message: error.message }, 500);
    }
  });

  app.post('/api/contacts', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon' && role !== 'staff') {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const body = await c.req.json();
      const requiredFields = ['memberId', 'deaconId', 'contactType', 'summary', 'contactDate'];
      for (const field of requiredFields) {
        if (!body[field] || body[field] === null || body[field] === '' || body[field] === undefined) {
          return c.json({ error: 'Validation failed', message: `Missing required field: ${field}` }, 400);
        }
      }

      const validContactTypes = ['phone', 'visit', 'church', 'voicemail'];
      if (!validContactTypes.includes(body.contactType)) {
        return c.json({ error: 'Validation failed', message: `Invalid contactType. Must be one of: ${validContactTypes.join(', ')}` }, 400);
      }

      const contactData = {
        ...body,
        memberId: Array.isArray(body.memberId) ? body.memberId : [body.memberId],
        deaconId: Array.isArray(body.deaconId) ? body.deaconId : [body.deaconId],
        followUpRequired: body.followUpRequired || false,
        createdAt: new Date().toISOString(),
      };

      const result = await safeCollectionInsert('contacts', contactData);
      return c.json({ message: 'Contact log created successfully', id: result.insertedId, contact: contactData });
    } catch (error) {
      getLogger().error(error, 'Error creating contact log:');
      return c.json({ error: 'Failed to create contact log', message: error.message }, 500);
    }
  });

  app.get('/api/households/:householdId/contacts', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon' && role !== 'staff') {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const members = await safeCollectionFind('members', { householdId: c.req.param('householdId') });
      if (!members || members.length === 0) {
        return c.json({ error: 'Household not found or has no members' }, 404);
      }
      const contacts = await safeCollectionFind('contacts', { memberId: { $in: members.map(m => m._id) } });
      await Promise.all(contacts.map(async element => {
        element.contactedBy = await Promise.all(element.deaconId.map(async deaconId => {
          let deacon = await safeCollectionFind('members', { _id: deaconId });
          getLogger().debug('Deacon:', deacon);
          deacon = deacon[0];
          return deacon ? { memberId: deacon._id, firstName: deacon.firstName, lastName: deacon.lastName } : null;
        }));
      }));
      return c.json({ contacts, count: contacts.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching households:');
      return c.json({ error: 'Failed to fetch households', message: error.message }, 500);
    }
  });

  app.get('/api/reports/summary', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon' && role !== 'staff') {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      // Fetch households with members and assigned deacons
      const assignments = await safeCollectionFind('assignments', { isActive: true });
      const householdIds = Array.from(new Set(assignments.map(a => a.householdId)));
      const households = await safeCollectionFind('households', { _id: { $in: householdIds } });
      const members = await safeCollectionFind('members', { householdId: { $in: householdIds } });
      const deacons = await safeCollectionFind('members', { tags: { $in: ['deacon', 'deaconess', 'staff'] } });
      let contacts = await safeCollectionFind('contacts', { memberId: { $in: members.map(m => m._id) } }) || [];
      contacts = contacts.sort((a, b) => new Date(b.contactDate) - new Date(a.contactDate));
      const summary = households.map(household => {
        const householdMembers = members.filter(m => m.householdId === household._id);
        const householdMemberIds = householdMembers.map(m => m._id);
        const assignedDeacons = assignments
          .filter(a => a.householdId === household._id);
        const deaconMembers = deacons.filter(d => assignedDeacons.some(a => a.deaconMemberId === d._id));
        const lastContact = contacts.find(c => c.memberId.some(id => householdMemberIds.includes(id))) || {};
        const summary = lastContact?.summary || 'No contact logged';
        household.members = householdMembers;
        lastContact.contactedBy = deacons?.filter(d => lastContact?.deaconId?.includes(d._id));
        
        return {
          household,
          // household: {
          //   householdId: '12345',
          //   lastName: 'Doe',
          //   members: [
          //     { memberId: '1', firstName: 'John', lastName: 'Doe' },
          //     { memberId: '2', firstName: 'Jane', lastName: 'Doe' }
          //   ],
          //   address: {
          //     street: '123 Main St',
          //     city: 'Anytown',
          //     state: 'CA',
          //     zipCode: '12345'
          //   },
          //   phone: [{
          //     type: 'home',
          //     number: '555-1234',
          //     firstInitial: 'J'
          //   }]
          // },
          assignedDeacons: deaconMembers,
          lastContact,
          // lastContact: {
          //   contactDate: '2023-10-01',
          //   contactType: 'phone',
          //   summary: 'Called to check in',
          //   contactedBy: [{ memberId: '1', firstName: 'John', lastName: 'Doe' }],
          // },
          summary
        }
        return summary;
      });
      return c.json({ summary });
    } catch (error) {
      getLogger().error(error, 'Error fetching contact summary:');
      return c.json({ error: 'Failed to fetch contact summary', message: error.message }, 500);
    }
  });
}
