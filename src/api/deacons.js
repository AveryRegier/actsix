import { getLogger } from '../logger.js';
import { safeCollectionFind } from '../helpers.js';
import { verifyRole } from '../auth.js';

export default function registerDeaconRoutes(app) {
  app.get('/api/deacons', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      let tags = ['deacon'];
      const other = c.req.query('add')?.split(',').map(tag => tag.trim());
      if(other) {
        tags.push(...other);
      }
      const members = await safeCollectionFind('members', { tags: { $in: tags } });
      return c.json({ deacons: members, count: members.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching deacons:');
      return c.json({ error: 'Failed to fetch deacons', message: error.message }, 500);
    }
  });

  app.get('/api/participants', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const members = await safeCollectionFind('members', { tags: { $in: ['deacon', 'elder', 'staff'] } })
      .then(members => members.map(member => ({
          ...member,
          role: member.tags.includes('deacon') ? 'Deacon' : member.tags.includes('elder') ? 'Elder' : 'Staff'
        })));
      return c.json({ participants: members, count: members.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching participants:');
      return c.json({ error: 'Failed to fetch participants', message: error.message }, 500);
    }
  });

  // Bulk quick contacts for a deacon: assignments + household + members + last contact
  app.get('/api/deacons/:deaconMemberId/quickContacts', async (c) => {
    if (!verifyRole(c, ['deacon', 'staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    try {
      const deaconMemberId = c.req.param('deaconMemberId');

      // 1) Get active assignments for this deacon
      const assignments = await safeCollectionFind('assignments', { deaconMemberId, isActive: true }) || [];
      if (!assignments.length) return c.json({ quickContacts: [] });

      const householdIds = Array.from(new Set(assignments.map(a => a.householdId)));

      // 2) Fetch households and members in parallel, then fetch only contacts involving this deacon
      const [households = [], members = []] = await Promise.all([
        safeCollectionFind('households', { _id: { $in: householdIds } }),
        safeCollectionFind('members', { householdId: { $in: householdIds } })
      ]);

      // Fetch contacts for those members where this deacon was involved (most efficient)
      const memberIds = members.map(m => m._id).filter(Boolean);
      const contacts = memberIds.length ? await safeCollectionFind('contacts', { memberId: { $in: memberIds }, deaconId: { $in: [deaconMemberId] } }) : [];

      // Map memberId -> householdId for quick lookup
      const memberHouseholdMap = new Map();
      members.forEach(m => { if (m._id) memberHouseholdMap.set(m._id, m.householdId); });

      // Filter contacts to only those belonging to these members
      const householdMemberIds = new Set(members.map(m => m._id));
      const relevantContacts = (contacts || []).filter(ct => ct.memberId && ct.memberId.some(id => householdMemberIds.has(id)));

      // Build last contact per household map
      const lastContactByHousehold = new Map();
      for (const ct of relevantContacts) {
        // determine the household for this contact by finding any memberId's household
        const hId = (ct.memberId || []).map(id => memberHouseholdMap.get(id)).find(Boolean);
        if (!hId) continue;
        const existing = lastContactByHousehold.get(hId);
        if (!existing || new Date(ct.contactDate) > new Date(existing.contactDate)) {
          lastContactByHousehold.set(hId, ct);
        }
      }

      // We intentionally do not resolve deacon names for lastContact —
      // the route only needs to return the contact records where the
      // current deacon participated. That keeps the query fast.

      // Build quickContacts array preserving order of assignments
      const quickContacts = assignments.map(a => {
        const hId = a.householdId;
        const household = (households || []).find(h => h._id === hId) || { _id: hId };
        const householdMembers = members.filter(m => m.householdId === hId && !m.tags?.includes('deceased'));

        // display name: join first names and append last name
        const displayName = householdMembers.map(m => m.firstName).join(' & ') + ' ' + (householdMembers[0]?.lastName || household.lastName || '');

        const lastContact = lastContactByHousehold.has(hId) ? lastContactByHousehold.get(hId) : null;
        let resolvedLastContact = null;
        if (lastContact) {
          // Return the raw lastContact record (includes deaconId array).
          // We avoid extra lookups to keep this route lightweight.
          resolvedLastContact = { ...lastContact };
        }

        // assigned deacons for this household
        const assigned = assignments.filter(asg => asg.householdId === hId).map(asg => asg.deaconMemberId);
        const assignedDeacons = (assigned.length ? (async () => {
          // resolve assigned deacon member info (sync below if needed)
          return [];
        })() : []);

        return {
          householdId: hId,
          displayName: displayName.trim(),
          members: householdMembers.map(m => ({ _id: m._id, firstName: m.firstName, lastName: m.lastName, phone: m.phone, tags: m.tags })),
          primaryPhone: household.primaryPhone || '',
          address: household.address || {},
          lastContact: resolvedLastContact,
          assignedDeacons: []
        };
      });

      // Return the compiled quickContacts
      return c.json({ quickContacts });
    } catch (error) {
      getLogger().error(error, 'Error fetching quick contacts:');
      return c.json({ error: 'Failed to fetch quick contacts', message: error.message }, 500);
    }
  });
}
