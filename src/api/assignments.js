import { safeCollectionFind, safeCollectionInsert, db } from '../helpers.js';

export default function registerAssignmentRoutes(app) {
  app.get('/api/assignments', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon' && role !== 'staff') {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const assignments = await safeCollectionFind('assignments');
      return c.json({ assignments, count: assignments.length });
    } catch (error) {
      console.error('Error fetching assignments:', error);
      return c.json({ error: 'Failed to fetch assignments', message: error.message }, 500);
    }
  });

  app.post('/api/assignments', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon') {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const body = await c.req.json();
      const requiredFields = ['deaconMemberId', 'householdId'];
      for (const field of requiredFields) {
        if (!body[field]) {
          return c.json({ error: 'Validation failed', message: `Missing required field: ${field}` }, 400);
        }
      }

      const assignmentData = {
        ...body,
        isActive: body.isActive !== undefined ? body.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await safeCollectionInsert('assignments', assignmentData);
      return c.json({ message: 'Assignment created successfully', id: result.insertedId, assignment: assignmentData });
    } catch (error) {
      console.error('Error creating assignment:', error);
      return c.json({ error: 'Failed to create assignment', message: error.message }, 500);
    }
  });

  app.get('/api/deacons/:deaconMemberId/assignments', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon') {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const deaconMemberId = c.req.param('deaconMemberId');
      const assignments = await safeCollectionFind('assignments', { deaconMemberId });
      return c.json({ deaconMemberId, assignments, count: assignments.length });
    } catch (error) {
      console.error('Error fetching deacon assignments:', error);
      return c.json({ error: 'Failed to fetch deacon assignments', message: error.message }, 500);
    }
  });

  app.get('/api/households/:householdId/assignments', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon' && role !== 'staff') {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const householdId = c.req.param('householdId');
      const assignments = await safeCollectionFind('assignments', { householdId, isActive: true });
      const deaconInfo = await safeCollectionFind('members', { _id: { $in: assignments.map(a => a.deaconMemberId) } });
      assignments.forEach(assignment => {
        const deacon = deaconInfo.find(d => d._id === assignment.deaconMemberId);
        if (deacon) {
          assignment.deacon = deacon;
        }
      });
      return c.json({ householdId, assignments, count: assignments.length });
    } catch (error) {
      console.error('Error fetching household assignments:', error);
      return c.json({ error: 'Failed to fetch household assignments', message: error.message }, 500);
    }
  });

  app.post('/api/households/:householdId/assignments', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon') {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const householdId = c.req.param('householdId');
      const body = await c.req.json();
      const deaconIds = Array.isArray(body.deaconIds) ? body.deaconIds : [];
      const existingAssignments = await safeCollectionFind('assignments', { householdId, isActive: true });

      for (const assignment of existingAssignments) {
        if (!deaconIds.includes(assignment.deaconMemberId)) {
          db.collection('assignments').updateOne(
            { _id: assignment._id },
            { $set: { isActive: false, updatedAt: new Date().toISOString() } }
          );
        } else {
          const index = deaconIds.indexOf(assignment.deaconMemberId);
          if (index > -1) {
            deaconIds.splice(index, 1);
          }
        }
      }

      for (const deaconMemberId of deaconIds) {
        const assignmentData = {
          deaconMemberId,
          householdId,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const result = await safeCollectionInsert('assignments', assignmentData);
        if (!result.insertedId) {
          return c.json({ error: 'Failed to create assignment', message: 'Could not insert new assignment into database' }, 500);
        }
      }

      return c.json({ message: 'Assignments updated', assignments: await safeCollectionFind('assignments', { householdId, isActive: true }) });
    } catch (error) {
      console.error('Error updating assignments:', error);
      return c.json({ error: 'Failed to update assignments', message: error.message }, 500);
    }
  });
}
