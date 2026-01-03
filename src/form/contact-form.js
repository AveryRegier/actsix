import { verifyRole } from '../auth/auth.js';
import { getLogger } from '../util/logger.js';

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

      logger.info('Submitting contact data to API', { contactData });

      // Call the existing API endpoint internally
      const apiRequest = new Request(new URL('/api/contacts', c.req.url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData)
      });

      // Create a new context for the API call with auth info
      const apiResponse = await app.fetch(apiRequest, {
        ...c.env,
        req: {
          ...c.req,
          memberId: c.req.memberId,
          role: c.req.role
        }
      });

      if (apiResponse.ok) {
        // Success - redirect to household page
        logger.info('Contact created successfully, redirecting', { householdId });
        return c.redirect(`/household.html?id=${householdId}`);
      } else {
        // API returned an error
        const errorData = await apiResponse.json().catch(() => ({ error: 'Unknown error' }));
        logger.error('API error creating contact', { status: apiResponse.status, error: errorData });
        
        return c.html(`
          <!DOCTYPE html>
          <html>
          <head><title>Error</title><link rel="stylesheet" href="/site.css"></head>
          <body>
            <div class="container">
              <h1>Error Recording Contact</h1>
              <p>${errorData.message || errorData.error || 'Failed to record contact'}</p>
              <a href="/record-contact.html?householdId=${householdId}" class="btn">Try Again</a>
              <a href="/household.html?id=${householdId}" class="btn">Cancel</a>
            </div>
          </body>
          </html>
        `, apiResponse.status);
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
