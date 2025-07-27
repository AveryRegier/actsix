import { safeCollectionFind, safeCollectionInsert, validatePhoneRequirement, db } from '../helpers.js';

export default function registerMemberRoutes(app) {
  app.get('/api/members', async (c) => {
    try {
      const members = await safeCollectionFind('members');
      return c.json({ members, count: members.length });
    } catch (error) {
      console.error('Error fetching members:', error);
      return c.json({ error: 'Failed to fetch members', message: error.message }, 500);
    }
  });

  app.get('/api/households/:householdId/members', async (c) => {
    try {
      const householdId = c.req.param('householdId');
      const members = await safeCollectionFind('members', { householdId });
      return c.json({ members, count: members.length });
    } catch (error) {
      console.error('Error fetching members:', error);
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
      return c.json({ member });
    } catch (error) {
      console.error('Error fetching member:', error);
      return c.json({ error: 'Failed to fetch member', message: error.message }, 500);
    }
  });

  app.post('/api/members', async (c) => {
    try {
      const body = await c.req.json();
      let householdId = body.householdId;
      if (!householdId) {
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
        const validTags = ['deacon', 'elder', 'staff', 'member', 'attender', 'shut-in', 'cancer', 'long-term-needs', 'widow', 'widower', 'married', 'other-needs'];
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
        tags: body.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // if (!body.phone) {
      //   const hasPhoneNumber = await validatePhoneRequirement(body.householdId);
      //   if (!hasPhoneNumber) {
      //     return c.json({ error: 'Validation failed', message: 'At least one phone number is required per household.' }, 400);
      //   }
      // }

      const result = await safeCollectionInsert('members', memberData);
      return c.json({ message: 'Member created successfully', id: result.insertedId, member: memberData });
    } catch (error) {
      console.error('Error creating member:', error);
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
        const validTags = ['deacon', 'elder', 'staff', 'member', 'attender', 'shut-in', 'cancer', 'long-term-needs', 'widow', 'widower', 'married'];
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

      const members = await safeCollectionFind('members');
      const existingMember = members.find(m => m._id === memberId);

      if (!existingMember) {
        return c.json({ error: 'Member not found', message: 'The requested member was not found' }, 404);
      }

      const updateData = {
        ...existingMember,
        ...body,
        tags: body.tags || [],
        updatedAt: new Date().toISOString(),
      };

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
        return c.json({ error: 'Update failed', message: 'No changes were made' }, 400);
      }

      return c.json({ message: 'Member updated successfully', member: updateData });
    } catch (error) {
      console.error('Error updating member:', error);
      return c.json({ error: 'Failed to update member', message: error.message }, 500);
    }
  });
}
