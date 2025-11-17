import { getLogger } from '../util/logger.js';
import { writeHouseholdSummary } from '../ai/summary-controller.js';

export default function registerInternalRoutes(app) {
  app.post('/api/internal/generate-household-summary', async (c) => {
    const logger = getLogger();
    const key = c.req.header('x-api-key') || c.req.header('authorization')?.slice(7) || '';
    if (!process.env.GENERATION_API_KEY || key !== process.env.GENERATION_API_KEY) {
      logger.warn('Unauthorized internal generate request');
      return c.json({ error: 'Unauthorized' }, 403);
    }

    let body = {};
    try {
      body = await c.req.json();
    } catch (e) {
      // ignore
    }
    const householdId = body && body.householdId;
    if (!householdId) {
      return c.json({ error: 'Missing householdId' }, 400);
    }

    // Perform the heavy work here (await) so the invoked request completes the work.
    try {
      const result = await writeHouseholdSummary(householdId);
      return c.json({ status: 'ok',  result }, 200);
    } catch (err) {
      logger.error(err, 'Internal generate failed');
      return c.json({ error: 'Generation failed' }, 500);
    }
  });

  // (detector endpoint removed)
}
