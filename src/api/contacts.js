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
      console.error('Error creating contact log:', error);
      return c.json({ error: 'Failed to create contact log', message: error.message }, 500);
    }
  });

  app.get('/api/reports/summary', async (c) => {
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
      console.error('Error fetching contact summary:', error);
      return c.json({ error: 'Failed to fetch contact summary', message: error.message }, 500);
    }
  });
}
