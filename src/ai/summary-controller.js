import { getLogger } from '../util/logger.js';
import { safeCollectionFind, safeCollectionUpdate } from '../util/helpers.js';
import callBedrockWithDocs from './bedrock.js';

export async function summarizeHousehold(householdId) {
  try {
    const logger = getLogger();

    const households = await safeCollectionFind('households', { _id: householdId }) || [];
    const household = households[0];
    if (!household) {
      return 'No household data';
    }

    const members = (await safeCollectionFind('members', { householdId }) || []);
    const memberIds = members.map((m) => m._id).filter(Boolean);

    let contacts = [];
    if (memberIds.length) {
      contacts = await safeCollectionFind('contacts', { memberId: { $in: memberIds } }) || [];
      contacts.sort((a, b) => new Date(b.contactDate).getTime() - new Date(a.contactDate).getTime());
    }

    const recentContacts = contacts.slice(0, 5).map((c) => ({
      contactDate: c.contactDate,
      contactType: c.contactType,
      summary: c.summary,
      followUpRequired: c.followUpRequired,
      deaconId: c.deaconId,
    }));

    const docs = [
      { type: 'household', data: { _id: household._id, lastName: household.lastName, primaryPhone: household.primaryPhone, email: household.email, address: household.address, notes: household.notes } },
      { type: 'members', data: members.map((m) => ({ _id: m._id, name: `${m.firstName || ''} ${m.lastName || ''}`.trim(), phone: m.phone, email: m.email, tags: m.tags || [], notes: m.notes })) },
      { type: 'recentContacts', data: recentContacts }
    ];
    // ensure the prompt is loaded once and cached across imports/runs
    if (!globalThis.__ACTSIX_AI_PROMPT_PROMISE) {
      globalThis.__ACTSIX_AI_PROMPT_PROMISE = (async () => {
        try {
          const fs = await import('fs/promises');
          const promptPath = new URL('./prompt.txt', import.meta.url);
          const txt = (await fs.readFile(promptPath, 'utf8')).toString().trim();
          return txt || 'gnerate an extremely consice summary of recent needs';
        } catch (err) {
          getLogger().warn?.(err, 'Could not read prompt.txt at module load');
          return 'gnerate an extremely consice summary of recent needs';
        }
      })();
    }
    const prompt = await globalThis.__ACTSIX_AI_PROMPT_PROMISE.catch((err) => {
      getLogger().warn?.(err, 'Error getting cached prompt');
      return 'gnerate an extremely consice summary of recent needs';
    });

    const resp = await callBedrockWithDocs(docs, prompt, { maxTokens: 80, temperature: 0.2 });
    const summary = (resp.output || '').trim().replace(/\s+/g, ' ');

    return summary || 'No summary available';
  } catch (err) {
    getLogger().error(err, 'Error summarizing household');
    return 'Summary unavailable';
  }
}

export async function writeHouseholdSummary(householdId) {
  const logger = getLogger();
  try {
    const summary = await summarizeHousehold(householdId);
    if (!summary) {
      return { summary: '', updated: false };
    }

    const update = { $set: { aiSummary: summary, aiSummaryUpdatedAt: new Date().toISOString() } };
    const result = await safeCollectionUpdate('households', { _id: householdId }, update);

    const updated = Boolean(result && (result.modifiedCount > 0 || result.upsertedCount > 0));
    if (!updated) {
      logger.debug('writeHouseholdSummary: update returned', result);
    }
    return { summary, updated };
  } catch (err) {
    logger.error(err, 'Error writing household summary');
    return { summary: '', updated: false };
  }
}

export default summarizeHousehold;
