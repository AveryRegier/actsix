import { safeCollectionFind } from '../helpers.js';

export default function registerDeaconRoutes(app) {
  app.get('/api/deacons', async (c) => {
    try {
      const members = await safeCollectionFind('members', { tags: { $in: ['deacon'] } });
      return c.json({ deacons: members, count: members.length });
    } catch (error) {
      console.error('Error fetching deacons:', error);
      return c.json({ error: 'Failed to fetch deacons', message: error.message }, 500);
    }
  });

  app.get('/api/participants', async (c) => {
    try {
      const members = await safeCollectionFind('members', { tags: { $in: ['deacon', 'elder', 'staff'] } })
      .then(members => members.map(member => ({
          ...member,
          role: member.tags.includes('deacon') ? 'Deacon' : member.tags.includes('elder') ? 'Elder' : 'Staff'
        })));
      return c.json({ participants: members, count: members.length });
    } catch (error) {
      console.error('Error fetching participants:', error);
      return c.json({ error: 'Failed to fetch participants', message: error.message }, 500);
    }
  });
}
