import { verifyRole } from '../auth/auth.js';
import { getLogger } from '../util/logger.js';
import { getCookie } from 'hono/cookie';

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

      // Get JWT token from cookie to pass to API
      const jwtToken = getCookie(c, 'actsix');
      
      if (!jwtToken) {
        throw new Error('No authentication token found');
      }

      // Call the existing API endpoint via HTTP with Authorization header
      const apiUrl = new URL('/api/contacts', c.req.url);
      const apiResponse = await fetch(apiUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify(contactData)
      });

      if (apiResponse.ok) {
        const result = await apiResponse.json();
        logger.info('Contact created successfully', { contactId: result.id });
        return c.redirect(`/household.html?id=${householdId}`);
      } else {
        const errorText = await apiResponse.text();
        logger.error('API error:', errorText);
        throw new Error(`API request failed: ${apiResponse.status} ${errorText}`);
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
