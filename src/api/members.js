import { getLogger } from '../logger.js';
import { ApiError, handleApiError } from '../error.js';
import { safeCollectionFind, safeCollectionInsert, validatePhoneRequirement, db } from '../helpers.js';

function validationErrorResponse(c, message, statusCode = 400) {
  throw new ApiError(message, statusCode);
  // return c.json({ error: 'Validation failed', message }, statusCode); 
}

export default function registerMemberRoutes(app) {
  app.get('/api/members', async (c) => {
    try {
      const members = await safeCollectionFind('members');
      return c.json({ members, count: members.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching members:');
      return c.json({ error: 'Failed to fetch members', message: error.message }, 500);
    }
  });

  app.get('/api/households/:householdId/members', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    let householdId = c.req.param('householdId');
    if (role !== 'deacon' && role !== 'staff') {
      const members = await safeCollectionFind('members', { _id: c.req.memberId }) || [];
      if(!members.map(m=>m.householdId).includes(householdId)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }
    }
    try {
      const members = await safeCollectionFind('members', { householdId });
      return c.json({ members, count: members.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching members:');
      return c.json({ error: 'Failed to fetch members', message: error.message }, 500);
    }
  });

  app.get('/api/members/:id', async (c) => {
    try {
      const memberId = c.req.param('id');
      const members = await safeCollectionFind('members', { _id: memberId });
      const member = members[0];
      if (!member) {
        return c.json({ error: 'Member not found', message: 'No member found with the given ID.' }, 404);
      }
      const role = c.req.role; // Assuming role is set in the request
      if (role !== 'deacon' && role !== 'staff') {
        if(c.req.memberId !== member._id) {
          return c.json({ error: 'Unauthorized access' }, 403);
        }
      }
      return c.json({ member });
    } catch (error) {
      getLogger().error(error, 'Error fetching member:');
      return c.json({ error: 'Failed to fetch member', message: error.message }, 500);
    }
  });

  app.post('/api/members', async (c) => {
    try {
      const role = c.req.role; // Assuming role is set in the request
      const body = await c.req.json();
      let householdId = body.householdId;
      if (!householdId) {
        if (role !== 'deacon' && role !== 'staff') {
          const members = await safeCollectionFind('members', { _id: c.req.memberId }) || [];
          if(!members.map(m=>m.householdId).includes(householdId)) {
            return c.json({ error: 'Unauthorized access' }, 403);
          }
        }
        if (!body.lastName) {
          return c.json({ error: 'Validation failed', message: 'Missing lastName for household creation.' }, 400);
        }
        const householdRes = await safeCollectionInsert('households', {
          lastName: body.lastName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        householdId = householdRes.insertedId?.toString(); // Ensure householdId is correctly assigned
      }

      const requiredFields = ['firstName', 'lastName', 'relationship', 'gender'];
      for (const field of requiredFields) {
        if (!body[field]) {
          return c.json({ error: 'Validation failed', message: `Missing required field: ${field}` }, 400);
        }
      }

      const validRelationships = ['head', 'spouse', 'child', 'other'];
      if (!validRelationships.includes(body.relationship)) {
        return c.json({ error: 'Validation failed', message: `Invalid relationship. Must be one of: ${validRelationships.join(', ')}` }, 400);
      }

      const validGenders = ['male', 'female'];
      if (!validGenders.includes(body.gender)) {
        return c.json({ error: 'Validation failed', message: `Invalid gender. Must be one of: ${validGenders.join(', ')}` }, 400);
      }

      if (body.tags && Array.isArray(body.tags)) {
        const validTags = ['deacon', 'deaconess', 'elder', 'staff', 'member', 'attender', 'shut-in', 'cancer', 'long-term-needs', 'widow', 'widower', 'married', 'other-needs', 'deceased'];
        for (const tag of body.tags) {
          if (!validTags.includes(tag)) {
            return c.json({ error: 'Validation failed', message: `Invalid tag "${tag}". Must be one of: ${validTags.join(', ')}` }, 400);
          }
        }
      }

      if (body.age && body.birthDate) {
        return c.json({ error: 'Validation failed', message: 'Cannot provide both age and birthDate. Please provide only one.' }, 400);
      }

      if (body.age && (body.age < 0 || body.age > 150)) {
        return c.json({ error: 'Validation failed', message: 'Age must be between 0 and 150' }, 400);
      }

      const memberData = {
        ...body,
        householdId,
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // only other deacons can modify tags as they allow secure access to the site
      if(role === 'deacon' || role === 'staff') {
        memberData.tags = body.tags || [];
      }

      const result = await safeCollectionInsert('members', memberData);
      return c.json({ message: 'Member created successfully', id: result.insertedId, member: memberData });
    } catch (error) {
      getLogger().error(error, 'Error creating member:');
      return c.json({ error: 'Failed to create member', message: error.message }, 500);
    }
  });

  app.put('/api/members/:id', async (c) => {
    try {
      const memberId = c.req.param('id');
      const body = await c.req.json();

      const requiredFields = ['firstName', 'lastName', 'relationship', 'gender'];
      for (const field of requiredFields) {
        if (!body[field]) {
          validationErrorResponse(c, `Missing required field: ${field}`);
        }
      }

      const validRelationships = ['head', 'spouse', 'child', 'other'];
      if (!validRelationships.includes(body.relationship)) {
        validationErrorResponse(c, `Invalid relationship. Must be one of: ${validRelationships.join(', ')}`);
      }

      const validGenders = ['male', 'female'];
      if (!validGenders.includes(body.gender)) {
        validationErrorResponse(c, `Invalid gender. Must be one of: ${validGenders.join(', ')}`);
      }

      if (body.tags && Array.isArray(body.tags)) {
        const validTags = ['deacon', 'elder', 'staff', 'member', 'attender', 'shut-in', 'cancer', 'long-term-needs', 'widow', 'widower', 'married', 'deceased'];
        for (const tag of body.tags) {
          if (!validTags.includes(tag)) {
            validationErrorResponse(c, `Invalid tag "${tag}". Must be one of: ${validTags.join(', ')}`);
          }
        }
      }

      if (body.age && body.birthDate) {
        validationErrorResponse(c, 'Cannot provide both age and birthDate. Please provide only one.');
      }

      if (body.age && (body.age < 0 || body.age > 150)) {
        validationErrorResponse(c, 'Age must be between 0 and 150');
      }

      const members = await safeCollectionFind('members', { _id: memberId });
      const existingMember = members.pop();

      if (!existingMember) {
        validationErrorResponse(c, 'The requested member was not found', 404);
      }

      const updateData = {
        ...existingMember,
        ...body,
        updatedAt: new Date().toISOString(),
      };
      // only other deacons can modify tags as they allow secure access to the site
      const role = c.req.role; // Assuming role is set in the request
      if(role === 'deacon' || role === 'staff') {
        updateData.tags = body.tags || [];
      }

      if (body.birthDate) {
        delete updateData.age;
      } else if (body.age) {
        delete updateData.birthDate;
      }

      const collection = db.collection('members');
      const result = await collection.updateOne(
        { _id: memberId },
        { $set: updateData }
      );

      if (result.modifiedCount === 0) {
        validationErrorResponse(c, 'No changes were made', 400);
      }

      return c.json({ message: 'Member updated successfully', member: updateData });
    } catch (error) {
      return handleApiError(c, error);
    }
  });
}
