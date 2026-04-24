import { getLogger } from '../util/logger.js';
import { safeCollectionFind, safeCollectionFindOne, safeCollectionInsert, safeCollectionUpdate } from '../util/helpers.js';
import { hasRole, verifyRole } from '../auth/auth.js';
import { randomUUID } from 'crypto';

const VALID_PHASES = ['discovery', 'vetting', 'preparation', 'implementation', 'followup', 'completed', 'cancelled'];
const VALID_STATUSES = ['active', 'on-hold', 'completed', 'cancelled'];
const VALID_UPDATE_TYPES = ['note', 'status', 'blocker', 'resolved'];
const VALID_REQ_TYPES = ['material', 'plans', 'funding', 'labor', 'permit', 'other'];
const VALID_REQ_STATUSES = ['open', 'blocked', 'fulfilled'];

function normalizeProjectPayload(body, isCreate = true) {
  const missingFields = [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim() : '';
  const phase = typeof body.phase === 'string' ? body.phase.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : 'active';

  if (isCreate) {
    if (!title) missingFields.push('title');
    if (!description) missingFields.push('description');
    if (!householdId) missingFields.push('householdId');
    if (!phase) missingFields.push('phase');
    // assignedDeaconIds must have at least one entry on create
    const ids = Array.isArray(body.assignedDeaconIds) ? body.assignedDeaconIds : [];
    if (ids.length === 0) missingFields.push('assignedDeaconIds');
  }

  if (missingFields.length > 0) {
    return { error: `Missing required field(s): ${missingFields.join(', ')}` };
  }

  if (phase && !VALID_PHASES.includes(phase)) {
    return { error: `Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}` };
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` };
  }

  const data = {};
  if (title) data.title = title;
  if (description) data.description = description;
  if (householdId) data.householdId = householdId;
  if (phase) data.phase = phase;
  if (status) data.status = status;

  if (body.assignedDeaconIds !== undefined) {
    data.assignedDeaconIds = Array.isArray(body.assignedDeaconIds) ? body.assignedDeaconIds : [];
  }
  if (body.workerIds !== undefined) {
    data.workerIds = Array.isArray(body.workerIds) ? body.workerIds : [];
  }
  if (body.estimatedCost !== undefined) {
    data.estimatedCost = body.estimatedCost !== null ? Number(body.estimatedCost) || null : null;
  }
  if (body.needsApproval !== undefined) {
    data.needsApproval = body.needsApproval === true || body.needsApproval === 'true';
  }
  if (body.communicationLink !== undefined) {
    data.communicationLink = typeof body.communicationLink === 'string' ? body.communicationLink.trim() : '';
  }

  return { data };
}

function normalizeRequirementItem(item) {
  return {
    _id: item._id || randomUUID(),
    type: VALID_REQ_TYPES.includes(item.type) ? item.type : 'other',
    description: typeof item.description === 'string' ? item.description.trim() : '',
    status: VALID_REQ_STATUSES.includes(item.status) ? item.status : 'open',
    owner: typeof item.owner === 'string' ? item.owner.trim() : '',
    notes: typeof item.notes === 'string' ? item.notes.trim() : '',
  };
}

function normalizeDocumentItem(item) {
  return {
    _id: item._id || randomUUID(),
    label: typeof item.label === 'string' ? item.label.trim() : '',
    url: typeof item.url === 'string' ? item.url.trim() : '',
    type: typeof item.type === 'string' ? item.type.trim() : 'document',
    addedBy: item.addedBy || null,
    addedAt: item.addedAt || new Date().toISOString(),
  };
}

async function enrichProject(project) {
  const [householdArr, leadDeaconArr, workers] = await Promise.all([
    safeCollectionFind('households', { _id: project.householdId }),
    project.leadDeaconId ? safeCollectionFind('members', { _id: project.leadDeaconId }) : Promise.resolve([]),
    project.workerIds?.length
      ? safeCollectionFind('members', { _id: { $in: project.workerIds } })
      : Promise.resolve([]),
  ]);
  const household = householdArr[0] || null;
  const leadDeacon = leadDeaconArr[0] || null;
  return {
    project,
    household: household ? {
      _id: household._id,
      lastName: household.lastName,
      address: household.address,
      primaryPhone: household.primaryPhone,
    } : null,
    leadDeacon: leadDeacon ? {
      _id: leadDeacon._id,
      firstName: leadDeacon.firstName,
      lastName: leadDeacon.lastName,
    } : null,
    workers: workers.map(w => ({ _id: w._id, firstName: w.firstName, lastName: w.lastName })),
  };
}

export default function registerProjectRoutes(app) {

  // List projects
  app.get('/api/projects', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff', 'worker'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const { status, phase, assignedDeaconId, householdId } = c.req.query();

      let query = {};
      if (hasRole(c, 'worker')) {
        // Workers only see projects they are assigned to
        query = { workerIds: { $in: [c.req.memberId] } };
      } else {
        if (status) query.status = status;
        if (phase) query.phase = phase;
        if (assignedDeaconId) query['assignedDeaconIds'] = { $in: [assignedDeaconId] };
        if (householdId) query.householdId = householdId;
      }

      const projects = await safeCollectionFind('projects', query);
      return c.json({ projects, count: projects.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching projects:');
      return c.json({ error: 'Failed to fetch projects', message: error.message }, 500);
    }
  });

  // Create project
  app.post('/api/projects', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const body = await c.req.json();
      const normalized = normalizeProjectPayload(body, true);
      if (normalized.error) {
        return c.json({ error: 'Validation failed', message: normalized.error }, 400);
      }

      const requirements = Array.isArray(body.requirements)
        ? body.requirements.map(normalizeRequirementItem)
        : [];
      const documents = Array.isArray(body.documents)
        ? body.documents.map(item => normalizeDocumentItem({ ...item, addedBy: c.req.memberId }))
        : [];

      const projectData = {
        ...normalized.data,
        requirements,
        documents,
        workerIds: normalized.data.workerIds || [],
        estimatedCost: normalized.data.estimatedCost ?? null,
        needsApproval: normalized.data.needsApproval ?? false,
        communicationLink: normalized.data.communicationLink ?? '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: c.req.memberId || null,
      };

      const result = await safeCollectionInsert('projects', projectData);
      return c.json({ message: 'Project created successfully', id: result.insertedId, project: { _id: result.insertedId, ...projectData } }, 201);
    } catch (error) {
      getLogger().error(error, 'Error creating project:');
      return c.json({ error: 'Failed to create project', message: error.message }, 500);
    }
  });

  // Get single project
  app.get('/api/projects/:projectId', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff', 'worker'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const projectId = c.req.param('projectId');
      const project = await safeCollectionFindOne('projects', { _id: projectId });
      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      if (hasRole(c, 'worker') && !project.workerIds?.includes(c.req.memberId)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const enriched = await enrichProject(project);
      return c.json(enriched);
    } catch (error) {
      getLogger().error(error, 'Error fetching project:');
      return c.json({ error: 'Failed to fetch project', message: error.message }, 500);
    }
  });

  // Update project
  app.patch('/api/projects/:projectId', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff', 'worker'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const projectId = c.req.param('projectId');
      const project = await safeCollectionFindOne('projects', { _id: projectId });
      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      if (hasRole(c, 'worker') && !project.workerIds?.includes(c.req.memberId)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const body = await c.req.json();
      const now = new Date().toISOString();
      let updateData = { updatedAt: now };

      if (hasRole(c, 'worker')) {
        // Workers may only update requirement status/notes and append documents
        if (body.requirements) {
          const existingMap = new Map((project.requirements || []).map(r => [r._id, r]));
          for (const item of body.requirements) {
            if (item._id && existingMap.has(item._id)) {
              const existing = existingMap.get(item._id);
              if (item.status && VALID_REQ_STATUSES.includes(item.status)) existing.status = item.status;
              if (item.notes !== undefined) existing.notes = String(item.notes || '').trim();
            }
          }
          updateData.requirements = [...existingMap.values()];
        }

        if (body.documents) {
          const newDocs = body.documents
            .filter(d => !d._id)
            .map(d => normalizeDocumentItem({ ...d, addedBy: c.req.memberId }));
          updateData.documents = [...(project.documents || []), ...newDocs];
        }
      } else {
        const isLeadOrStaff = hasRole(c, 'staff') || hasRole(c, 'lead-deacon') || project.assignedDeaconIds?.includes(c.req.memberId);

        const metaFields = ['title', 'description', 'phase', 'status', 'assignedDeaconIds', 'workerIds', 'estimatedCost', 'needsApproval', 'communicationLink'];
        const hasMetaChange = metaFields.some(f => body[f] !== undefined);
        if (hasMetaChange && !isLeadOrStaff) {
          return c.json({ error: 'Only the lead deacon or staff may update project metadata' }, 403);
        }

        const normalized = normalizeProjectPayload(body, false);
        if (normalized.error) {
          return c.json({ error: 'Validation failed', message: normalized.error }, 400);
        }
        Object.assign(updateData, normalized.data);

        if (body.requirements !== undefined) {
          updateData.requirements = body.requirements.map(normalizeRequirementItem);
        }
        if (body.documents !== undefined) {
          const existingIds = new Set((project.documents || []).map(d => d._id));
          const existingDocs = (project.documents || []);
          const newDocs = body.documents
            .filter(d => !d._id || !existingIds.has(d._id))
            .map(d => normalizeDocumentItem({ ...d, addedBy: d.addedBy || c.req.memberId }));
          const updatedDocs = body.documents
            .filter(d => d._id && existingIds.has(d._id))
            .map(d => {
              const existing = existingDocs.find(e => e._id === d._id);
              return { ...existing, ...d };
            });
          updateData.documents = [...updatedDocs, ...newDocs];
        }
      }

      const result = await safeCollectionUpdate('projects', { _id: projectId }, { $set: updateData });
      if (!result || result.matchedCount === 0) {
        return c.json({ error: 'Project not found' }, 404);
      }

      const updated = await safeCollectionFindOne('projects', { _id: projectId });
      return c.json({ message: 'Project updated successfully', id: projectId, project: updated });
    } catch (error) {
      getLogger().error(error, 'Error updating project:');
      return c.json({ error: 'Failed to update project', message: error.message }, 500);
    }
  });

  // Projects for a household
  app.get('/api/households/:householdId/projects', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const householdId = c.req.param('householdId');
      const projects = await safeCollectionFind('projects', { householdId });
      return c.json({ householdId, projects, count: projects.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching household projects:');
      return c.json({ error: 'Failed to fetch projects', message: error.message }, 500);
    }
  });

  // List updates for a project
  app.get('/api/projects/:projectId/updates', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff', 'worker'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const projectId = c.req.param('projectId');
      const project = await safeCollectionFindOne('projects', { _id: projectId });
      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      if (hasRole(c, 'worker') && !project.workerIds?.includes(c.req.memberId)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const updates = await safeCollectionFind('project-updates', { projectId });
      updates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Enrich with author names
      const authorIds = [...new Set(updates.map(u => u.authorId).filter(Boolean))];
      const authors = authorIds.length
        ? await safeCollectionFind('members', { _id: { $in: authorIds } })
        : [];
      const authorMap = new Map(authors.map(a => [a._id, a]));

      const enriched = updates.map(u => {
        const author = authorMap.get(u.authorId);
        return {
          ...u,
          author: author ? { firstName: author.firstName, lastName: author.lastName } : null,
        };
      });

      return c.json({ projectId, updates: enriched, count: enriched.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching project updates:');
      return c.json({ error: 'Failed to fetch project updates', message: error.message }, 500);
    }
  });

  // Add update to a project
  app.post('/api/projects/:projectId/updates', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff', 'worker'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const projectId = c.req.param('projectId');
      const project = await safeCollectionFindOne('projects', { _id: projectId });
      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      if (hasRole(c, 'worker') && !project.workerIds?.includes(c.req.memberId)) {
        return c.json({ error: 'Unauthorized access' }, 403);
      }

      const body = await c.req.json();
      const type = typeof body.type === 'string' ? body.type.trim() : '';
      const text = typeof body.text === 'string' ? body.text.trim() : '';

      if (!text) {
        return c.json({ error: 'Validation failed', message: 'Missing required field: text' }, 400);
      }
      if (!type || !VALID_UPDATE_TYPES.includes(type)) {
        return c.json({ error: 'Validation failed', message: `Invalid type. Must be one of: ${VALID_UPDATE_TYPES.join(', ')}` }, 400);
      }
      if (hasRole(c, 'worker') && type !== 'note') {
        return c.json({ error: 'Validation failed', message: 'Workers may only post updates of type: note' }, 400);
      }

      const updateData = {
        projectId,
        authorId: c.req.memberId || null,
        type,
        text,
        phaseSnapshot: project.phase,
        createdAt: new Date().toISOString(),
      };

      const result = await safeCollectionInsert('project-updates', updateData);
      return c.json({ message: 'Update added successfully', id: result.insertedId, update: { _id: result.insertedId, ...updateData } }, 201);
    } catch (error) {
      getLogger().error(error, 'Error adding project update:');
      return c.json({ error: 'Failed to add project update', message: error.message }, 500);
    }
  });
}
