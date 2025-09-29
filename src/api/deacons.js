import { getLogger } from '../logger.js';
import { safeCollectionFind } from '../helpers.js';

export default function registerDeaconRoutes(app) {
  app.get('/api/deacons', async (c) => {
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon' && role !== 'staff') {
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
    const role = c.req.role; // Assuming role is set in the request
    if (role !== 'deacon' && role !== 'staff') {
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
}
