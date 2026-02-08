import { getLogger } from '../util/logger.js';
import { ApiError, handleApiError } from '../util/error.js';
import { safeCollectionFind, safeCollectionInsert, safeCollectionUpdate } from '../util/helpers.js';
import { verifyRole } from '../auth/auth.js';
import { type } from 'os';

function validationErrorResponse(c, message, statusCode = 400) {
  throw new ApiError(message, statusCode);
  // return c.json({ error: 'Validation failed', message }, statusCode); 
}

function validateTemporaryAddress(temporaryAddress) {
  if (!temporaryAddress) return null;

  const errors = [];

  // locationId is required
  if (!temporaryAddress.locationId) {
    errors.push('temporaryAddress.locationId is required');
  }

  // roomNumber is optional but should be string if provided
  if (temporaryAddress.roomNumber !== undefined && typeof temporaryAddress.roomNumber !== 'string') {
    errors.push('temporaryAddress.roomNumber must be a string');
  }

  // startDate is required
  if (!temporaryAddress.startDate) {
    errors.push('temporaryAddress.startDate is required');
  } else {
    // Validate date format
    const startDate = new Date(temporaryAddress.startDate);
    if (isNaN(startDate.getTime())) {
      errors.push('temporaryAddress.startDate must be a valid date');
    }
  }

  // endDate is optional but should be valid if provided
  if (temporaryAddress.endDate) {
    const endDate = new Date(temporaryAddress.endDate);
    if (isNaN(endDate.getTime())) {
      errors.push('temporaryAddress.endDate must be a valid date');
    }
    
    // endDate should be after startDate
    if (temporaryAddress.startDate) {
      const startDate = new Date(temporaryAddress.startDate);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate <= startDate) {
        errors.push('temporaryAddress.endDate must be after startDate');
      }
    }
  }

  // notes is optional but should be string if provided
  if (temporaryAddress.notes !== undefined && typeof temporaryAddress.notes !== 'string') {
    errors.push('temporaryAddress.notes must be a string');
  }

  // isActive should be boolean if provided, defaults to true
  if (temporaryAddress.isActive !== undefined && typeof temporaryAddress.isActive !== 'boolean') {
    errors.push('temporaryAddress.isActive must be a boolean');
  }

  if (errors.length > 0) {
    return errors.join('; ');
  }

  return null;
}

export default function registerMemberRoutes(app) {
  app.get('/api/members', async (c) => {
    try {
      let members = await safeCollectionFind('members');
      members = members.filter(m => !m.tags?.includes('deceased'));
      return c.json({ members, count: members.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching members:');
      return c.json({ error: 'Failed to fetch members', message: error.message }, 500);
    }
  });

  app.get('/api/households/:householdId/members', async (c) => {
    let householdId = c.req.param('householdId');
    if (!verifyRole(c, ['deacon', 'staff'])) {
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
      if (!verifyRole(c, ['deacon', 'staff'])) {
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
      const body = await c.req.json();
      let householdId = body.householdId;
      if (!householdId) {
        if (!verifyRole(c, ['deacon', 'staff'])) {
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
        const validTags = ['deacon', 'deaconess', 'elder', 'staff', 'member', 'attender', 'in-small-group', 'shut-in', 'cancer', 'long-term-needs', 'widow', 'widower', 'married', 'other-needs', 'deceased'];
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

      // Validate temporaryAddress if provided
      if (body.temporaryAddress) {
        const tempAddressError = validateTemporaryAddress(body.temporaryAddress);
        if (tempAddressError) {
          return c.json({ error: 'Validation failed', message: tempAddressError }, 400);
        }
        // Verify the location exists
        const locations = await safeCollectionFind('common_locations', { _id: body.temporaryAddress.locationId });
        if (locations.length === 0) {
          return c.json({ error: 'Validation failed', message: 'Invalid locationId: location not found' }, 400);
        }
        // Set isActive to true by default for new temporary addresses
        if (body.temporaryAddress.isActive === undefined) {
          body.temporaryAddress.isActive = true;
        }
      }

      const memberData = {
        ...body,
        householdId,
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // only other deacons can modify tags as they allow secure access to the site
      const role = c.req.role; // Assuming role is set in the request
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
        const validTags = ['deacon', 'deaconess', 'elder', 'staff', 'member', 'attender', "in-small-group", 'shut-in', 'cancer', 'long-term-needs', 'widow', 'widower', 'married', 'deceased'];
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

      // Validate temporaryAddress if provided
      if (body.temporaryAddress) {
        const tempAddressError = validateTemporaryAddress(body.temporaryAddress);
        if (tempAddressError) {
          validationErrorResponse(c, tempAddressError);
        }
        // Verify the location exists
        const locations = await safeCollectionFind('common_locations', { _id: body.temporaryAddress.locationId });
        if (locations.length === 0) {
          validationErrorResponse(c, 'Invalid locationId: location not found');
        }
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

      const result = await safeCollectionUpdate(
        'members',
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

  app.put('/api/members/:id/temporary-address', async (c) => {
    try {
      const memberId = c.req.param('id');
      const body = await c.req.json();

      // Get existing member
      const members = await safeCollectionFind('members', { _id: memberId });
      const member = members[0];
      if (!member) {
        return c.json({ error: 'Member not found', message: 'No member found with the given ID.' }, 404);
      }

      // Validate temporaryAddress
      if (!body.temporaryAddress) {
        return c.json({ error: 'Validation failed', message: 'temporaryAddress is required' }, 400);
      }

      const tempAddressError = validateTemporaryAddress(body.temporaryAddress);
      if (tempAddressError) {
        return c.json({ error: 'Validation failed', message: tempAddressError }, 400);
      }

      // Verify the location exists
      const locations = await safeCollectionFind('common_locations', { _id: body.temporaryAddress.locationId });
      if (locations.length === 0) {
        return c.json({ error: 'Validation failed', message: 'Invalid locationId: location not found' }, 400);
      }

      // Archive previous temporary address if it exists and is active
      if (member.temporaryAddress && member.temporaryAddress.isActive) {
        member.temporaryAddress.isActive = false;
      }

      // Set new temporary address
      const newTemporaryAddress = {
        ...body.temporaryAddress,
        isActive: body.temporaryAddress.isActive !== false
      };

      const result = await safeCollectionUpdate(
        'members',
        { _id: memberId },
        { $set: { temporaryAddress: newTemporaryAddress, updatedAt: new Date().toISOString() } }
      );

      if (result.modifiedCount === 0) {
        return c.json({ error: 'Update failed', message: 'Could not update member temporary address' }, 400);
      }

      return c.json({ 
        message: 'Temporary address set successfully', 
        member: { ...member, temporaryAddress: newTemporaryAddress, updatedAt: new Date().toISOString() }
      });
    } catch (error) {
      getLogger().error(error, 'Error setting temporary address:');
      return c.json({ error: 'Failed to set temporary address', message: error.message }, 500);
    }
  });

  app.delete('/api/members/:id/temporary-address', async (c) => {
    try {
      const memberId = c.req.param('id');

      // Get existing member
      const members = await safeCollectionFind('members', { _id: memberId });
      const member = members[0];
      if (!member) {
        return c.json({ error: 'Member not found', message: 'No member found with the given ID.' }, 404);
      }

      if (!member.temporaryAddress) {
        return c.json({ error: 'No temporary address', message: 'This member has no temporary address.' }, 404);
      }

      // Remove temporary address
      const result = await safeCollectionUpdate(
        'members',
        { _id: memberId },
        { $unset: { temporaryAddress: '' }, $set: { updatedAt: new Date().toISOString() } }
      );

      if (result.modifiedCount === 0) {
        return c.json({ error: 'Update failed', message: 'Could not remove member temporary address' }, 400);
      }

      return c.json({ 
        message: 'Temporary address removed successfully',
        member: { ...member, updatedAt: new Date().toISOString() }
      });
    } catch (error) {
      getLogger().error(error, 'Error removing temporary address:');
      return c.json({ error: 'Failed to remove temporary address', message: error.message }, 500);
    }
  });

  app.get('/api/members/:id/temporary-address-history', async (c) => {
    try {
      const memberId = c.req.param('id');

      // Get existing member
      const members = await safeCollectionFind('members', { _id: memberId });
      const member = members[0];
      if (!member) {
        return c.json({ error: 'Member not found', message: 'No member found with the given ID.' }, 404);
      }

      // Return current temporary address (can be extended to support full history in future)
      const temporaryAddress = member.temporaryAddress || null;
      
      return c.json({ 
        memberId,
        currentTemporaryAddress: temporaryAddress,
        history: temporaryAddress ? [temporaryAddress] : []
      });
    } catch (error) {
      getLogger().error(error, 'Error fetching temporary address history:');
      return c.json({ error: 'Failed to fetch temporary address history', message: error.message }, 500);
    }
  });

  app.get('/api/temporary-locations/active', async (c) => {
    try {
      // Get all members with active temporary addresses
      const members = await safeCollectionFind('members', { 'temporaryAddress.isActive': true });
      
      if (!members || members.length === 0) {
        return c.json({ members: [], count: 0 });
      }

      // Enhance with location details
      const enhancedMembers = [];
      for (const member of members) {
        if (member.temporaryAddress) {
          const locations = await safeCollectionFind('common_locations', { _id: member.temporaryAddress.locationId });
          const location = locations[0];
          enhancedMembers.push({
            _id: member._id,
            firstName: member.firstName,
            lastName: member.lastName,
            householdId: member.householdId,
            temporaryAddress: member.temporaryAddress,
            location: location || null
          });
        }
      }

      return c.json({ 
        members: enhancedMembers,
        count: enhancedMembers.length
      });
    } catch (error) {
      getLogger().error(error, 'Error fetching members at temporary locations:');
      return c.json({ error: 'Failed to fetch members at temporary locations', message: error.message }, 500);
    }
  });

  app.get('/api/tags', async (c) => {
    return c.json({ tags: [
      { name: 'deacon', description: 'Deacon', type: 'role' },
      { name: 'deaconess', description: 'Deaconess', type: 'role' },
      { name: 'elder', description: 'Elder', type: 'role' },
      { name: 'staff', description: 'Staff', type: 'role' },
      { name: 'member', description: 'Member', type: 'situation' },
      { name: 'attender', description: 'Attender', type: 'situation' },
      { name: 'in-small-group', description: 'In Small Group', type: 'situation' },
      { name: 'shut-in', description: 'Shut-In', type: 'situation' },
      { name: 'cancer', description: 'Has Cancer', type: 'situation' },
      { name: 'long-term-needs', description: 'Has Long Term Needs', type: 'situation' },
      { name: 'widow', description: 'Widow', type: 'status' },
      { name: 'widower', description: 'Widower', type: 'status' },
      { name: 'married', description: 'Married', type: 'status' },
      { name: 'deceased', description: 'Deceased', type: 'status' },
    ] });
  })
};