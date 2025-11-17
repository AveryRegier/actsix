/**
 * Trigger the internal summary generation endpoint for a household.
 * This function attempts a fire-and-forget POST to the internal endpoint with the generation key.
 */
export function triggerHouseholdSummary(householdId) {
  try {
    const base = (process.env.API_GATEWAY_URL || '').replace(/\/$/, '');
    const url = base ? `${base}/api/internal/generate-household-summary` : `/api/internal/generate-household-summary`;

    // Fire-and-forget async invocation. Keep errors local.
    (async () => {
      try {
        // Use global fetch if available (Node 18+); it's fine to not await here.
        const headers = {
          'Content-Type': 'application/json',
          'x-generation-api-key': process.env.GENERATION_API_KEY || ''
        };
        // If absolute URL needed and API_GATEWAY_URL is not set in lambda, this may fail; it's intended
        // to be called in environments where API_GATEWAY_URL is configured or during local dev.
        await fetch(url, { method: 'POST', headers, body: JSON.stringify({ householdId }) });
      } catch (err) {
        // Best-effort trigger; log to console to avoid throwing in API flows
        // Logger may not be available from util here
        // eslint-disable-next-line no-console
        console.warn('triggerHouseholdSummary failed', err);
      }
    })();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('triggerHouseholdSummary immediate failure', err);
  }
}

export default triggerHouseholdSummary;
