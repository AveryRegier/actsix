import { getLogger } from '../util/logger.js';
import { safeCollectionFind, safeCollectionFindOne, safeCollectionInsert, getCache, setCache } from '../util/helpers.js';
import { verifyRole } from '../auth/auth.js';

export default function registerContactRoutes(app) {
  app.get('/api/contacts', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff'])) {
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

  app.get('/api/contacts/needs', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const contacts = await safeCollectionFind('contacts', {
        $groupBy: '$memberId',
        $set: {
          memberId: '$memberId',
          lastContactDate: { $max: '$contactDate' },
          followUpRequired: { $last: '$followUpRequired' }
        }
      }).filter(c => c.createdAt && (new Date(c.createdAt) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) || c.followUpRequired));
      
      // all these memberIds must have current deacon assignments
      const assignments = await safeCollectionFind('assignments', { isActive: true });
      const assignedHouseholdIds = Array.from(new Set(assignments.map(a => a.householdId)));
      const members = await safeCollectionFind('members', { _id: { $in: contacts.map(c => c.memberId).flat() }, householdId: { $in: assignedHouseholdIds } });
      const contactsWithAssignments = contacts.filter(c => members.some(m => c.memberId.includes(m._id)));
      
      const contactsWithMembers = contactsWithAssignments.map(contact => {
        const memberDetails = members.filter(m => contact.memberId.includes(m._id));
        return { ...contact, members: memberDetails };
      });
      return c.json({ contacts: contactsWithMembers, count: contactsWithMembers.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching contacts:');
      return c.json({ error: 'Failed to fetch contacts', message: error.message }, 500);
    }
  });

  app.post('/api/contacts', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff'])) {
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

      const validContactTypes = ['phone', 'visit', 'church', 'text', 'voicemail'];
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
    if (!verifyRole(c, ['deacon', 'staff'])) {
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
      contacts.sort((a, b) => new Date(b.contactDate) - new Date(a.contactDate));
      return c.json({ contacts, count: contacts.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching households:');
      return c.json({ error: 'Failed to fetch households', message: error.message }, 500);
    }
  });

  app.get('/api/reports/summary', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      // Try to serve cached summary if available
      try {
        const cacheDoc = await getCache('reports_summary');
        if (cacheDoc && cacheDoc.data) {
          const lastModified = new Date(cacheDoc.updatedAt).toUTCString();
          const ifModifiedSince = c.req.header('if-modified-since');
          if (ifModifiedSince) {
            const since = new Date(ifModifiedSince);
            if (!isNaN(since.getTime()) && new Date(cacheDoc.updatedAt) <= since) {
              return c.text('', 304);
            }
          }
          c.header('Last-Modified', lastModified);
          return c.json(cacheDoc.data);
        }
      } catch (cacheErr) {
        getLogger().warn('Failed to read reports cache, will regenerate', cacheErr);
      }
      // Fetch assignments first to know which households to include
      const assignments = await safeCollectionFind('assignments', { isActive: true });
      const householdIds = Array.from(new Set(assignments.map(a => a.householdId)));

      // Fetch households, members and deacons in parallel (members needs householdIds
      // but that's already available). Then fetch contacts once members are available.
      const [households = [], members = [], deacons = []] = await Promise.all([
        safeCollectionFind('households', { _id: { $in: householdIds } }),
        safeCollectionFind('members', { householdId: { $in: householdIds } }),
        safeCollectionFind('members', { tags: { $in: ['deacon', 'deaconess', 'staff'] } })
      ]);

      let contacts = await Promise.all(members.map(m => m._id).map(async memberId => {
        const memberContacts = await safeCollectionFindOne('contacts', { memberId: {$in: [memberId]} }, {
          sort: { contactDate: -1 }
        });
        return memberContacts;
      }));
      // if (members && members.length) {
      //   contacts = await safeCollectionFind('contacts', { memberId: { $in: members.map(m => m._id) } }) || [];
      // }
      // contacts = contacts.sort((a, b) => new Date(b.contactDate) - new Date(a.contactDate));
      const summary = households.map(household => {
        const householdMembers = members.filter(m => m.householdId === household._id).filter(m => !m.tags?.includes('deceased'));
        const householdMemberIds = householdMembers.map(m => m._id);
        const assignedDeacons = assignments
          .filter(a => a.householdId === household._id);
        const deaconMembers = deacons.filter(d => assignedDeacons.some(a => a.deaconMemberId === d._id));
        const lastContact = contacts.find(c => c?.memberId.some(id => householdMemberIds.includes(id))) || {};
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
        };
      });
      // store the entire JSON response in cache for future requests
      try {
        const responseObj = { summary };
        await setCache('reports_summary', responseObj);
      } catch (cacheErr) {
        getLogger().warn('Failed to write reports cache', cacheErr);
      }
      // set Last-Modified header from cache (just set to now)
      c.header('Last-Modified', new Date().toUTCString());
      return c.json({ summary });
    } catch (error) {
      getLogger().error(error, 'Error fetching contact summary:');
      return c.json({ error: 'Failed to fetch contact summary', message: error.message }, 500);
    }
  });
}
