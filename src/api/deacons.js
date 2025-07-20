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
}
