import { verifyRole } from '../auth/auth.js';
import { getLogger } from '../util/logger.js';
import { safeCollectionInsert } from '../util/helpers.js';

export default function registerContactFormRoutes(app) {
  app.post('/form/record-contact', async (c) => {
    const logger = getLogger();
    
    // Verify authorization
    if (!verifyRole(c, ['deacon', 'staff'])) {
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head><title>Unauthorized</title><link rel="stylesheet" href="/site.css"></head>
        <body>
          <div class="container">
            <h1>Unauthorized Access</h1>
            <p>You do not have permission to record contacts.</p>
            <a href="/" class="btn">Return Home</a>
          </div>
        </body>
        </html>
      `, 403);
    }

    try {
      // Parse form data
      const formData = await c.req.parseBody();
      
      // Extract householdId for redirect
      const householdId = formData.householdId;
      
      if (!householdId) {
        throw new Error('Missing householdId');
      }

      // Transform form data to API format
      const memberIds = Array.isArray(formData.memberId) 
        ? formData.memberId 
        : (formData.memberId ? [formData.memberId] : []);
      
      const deaconIds = Array.isArray(formData.deaconId)
        ? formData.deaconId
        : (formData.deaconId ? [formData.deaconId] : []);

      // Validate required fields
      if (memberIds.length === 0) {
        throw new Error('At least one member must be selected');
      }
      
      if (!formData.contactType || !formData.summary || !formData.contactDate) {
        throw new Error('Missing required fields');
      }

      const contactData = {
        memberId: memberIds,
        deaconId: deaconIds,
        contactType: formData.contactType,
        summary: formData.summary,
        contactDate: new Date(formData.contactDate).toISOString(),
        followUpRequired: formData.followUpRequired === 'true' || formData.followUpRequired === true
      };

      logger.info('Creating contact via data layer', { contactData });

      // Validate contact type (business logic from API layer)
      const validContactTypes = ['phone', 'visit', 'church', 'text', 'voicemail'];
      if (!validContactTypes.includes(contactData.contactType)) {
        throw new Error(`Invalid contactType. Must be one of: ${validContactTypes.join(', ')}`);
      }

      // Add timestamps
      contactData.createdAt = new Date().toISOString();

      // Call data layer directly (respects architecture: Form → Data)
      const result = await safeCollectionInsert('contacts', contactData);

      if (result && result.insertedId) {
        // Success - redirect to household page
        logger.info('Contact created successfully, redirecting', { householdId, contactId: result.insertedId });
        return c.redirect(`/household.html?id=${householdId}`);
      } else {
        // Insert failed
        logger.error('Failed to insert contact', { result });
        throw new Error('Failed to create contact record');
      }
    } catch (error) {
      logger.error(error, 'Error processing contact form:');
      
      const householdId = error.householdId || 'unknown';
      
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head><title>Error</title><link rel="stylesheet" href="/site.css"></head>
        <body>
          <div class="container">
            <h1>Error</h1>
            <p>${error.message || 'An unexpected error occurred'}</p>
            <a href="/record-contact.html${householdId !== 'unknown' ? '?householdId=' + householdId : ''}" class="btn">Try Again</a>
            <a href="/" class="btn">Return Home</a>
          </div>
        </body>
        </html>
      `, 500);
    }
  });
}
