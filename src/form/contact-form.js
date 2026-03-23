import { verifyRole } from '../auth/auth.js';
import { getLogger } from '../util/logger.js';
import { getCookie } from 'hono/cookie';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toArray(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(v => String(v || '').trim())
    .filter(Boolean);
}

function normalizeContactDate(rawDate) {
  const dateValue = String(rawDate || '').trim();
  if (!dateValue) {
    return null;
  }

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? new Date(`${dateValue}T12:00:00`)
    : new Date(dateValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function isSafeRelativeRedirect(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

function buildContactPayload(formData) {
  const memberIds = toArray(formData.memberId);
  const deaconIds = toArray(formData.deaconId);
  const contactType = String(formData.contactType || '').trim();
  const summary = String(formData.summary || '').trim();
  const contactDate = normalizeContactDate(formData.contactDate);

  if (memberIds.length === 0) {
    throw new Error('At least one member must be selected');
  }

  if (!contactType || !summary || !contactDate) {
    throw new Error('Missing required fields');
  }

  return {
    memberId: memberIds,
    deaconId: deaconIds,
    contactType,
    summary,
    contactDate,
    followUpRequired: formData.followUpRequired === 'true' || formData.followUpRequired === 'on' || formData.followUpRequired === true
  };
}

function renderUnauthorizedPage(message) {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Unauthorized</title><link rel="stylesheet" href="/site.css"></head>
    <body>
      <div class="container">
        <h1>Unauthorized Access</h1>
        <p>${escapeHtml(message)}</p>
        <a href="/" class="btn">Return Home</a>
      </div>
    </body>
    </html>
  `;
}

function renderErrorPage(message, retryHref) {
  const safeRetryHref = isSafeRelativeRedirect(retryHref) ? retryHref : '/';
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Error</title><link rel="stylesheet" href="/site.css"></head>
    <body>
      <div class="container">
        <h1>Error</h1>
        <p>${escapeHtml(message || 'An unexpected error occurred')}</p>
        <a href="${safeRetryHref}" class="btn">Try Again</a>
        <a href="/" class="btn">Return Home</a>
      </div>
    </body>
    </html>
  `;
}

function buildRedirectTarget(householdId, returnTo) {
  if (typeof returnTo === 'string' && returnTo.trim()) {
    const candidate = returnTo.trim();
    if (isSafeRelativeRedirect(candidate)) {
      return candidate;
    }
  }
  return `/household.html?id=${encodeURIComponent(householdId)}`;
}

async function submitContactToApi(c, method, path, payload) {
  const jwtToken = getCookie(c, 'actsix');
  if (!jwtToken) {
    throw new Error('No authentication token found');
  }

  const apiUrl = new URL(path, c.req.url);
  const apiResponse = await fetch(apiUrl.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(`API request failed: ${apiResponse.status} ${errorText}`);
  }

  return apiResponse.json();
}

export default function registerContactFormRoutes(app) {
  app.post('/form/record-contact', async (c) => {
    const logger = getLogger();
    let householdId = '';
    
    // Verify authorization
    if (!verifyRole(c, ['deacon', 'staff'])) {
      return c.html(renderUnauthorizedPage('You do not have permission to record contacts.'), 403);
    }

    try {
      const formData = await c.req.parseBody();
      householdId = String(formData.householdId || '').trim();
      const returnTo = formData.returnTo;

      if (!householdId) {
        throw new Error('Missing householdId');
      }

      const contactData = buildContactPayload(formData);

      logger.info('Submitting contact data to API', { contactData });

      const result = await submitContactToApi(c, 'POST', '/api/contacts', contactData);
      logger.info('Contact created successfully', { contactId: result.id });

      return c.redirect(buildRedirectTarget(householdId, returnTo));
    } catch (error) {
      logger.error(error, 'Error processing contact form:');

      const retryHref = householdId ? `/record-contact.html?householdId=${encodeURIComponent(householdId)}` : '/record-contact.html';
      return c.html(renderErrorPage(error.message, retryHref), 500);
    }
  });

  app.post('/form/edit-contact', async (c) => {
    const logger = getLogger();
    let householdId = '';
    let contactId = '';

    if (!verifyRole(c, ['deacon', 'staff', 'helper'])) {
      return c.html(renderUnauthorizedPage('You do not have permission to edit contacts.'), 403);
    }

    try {
      const formData = await c.req.parseBody();
      householdId = String(formData.householdId || '').trim();
      contactId = String(formData.contactId || '').trim();
      const returnTo = formData.returnTo;

      if (!householdId) {
        throw new Error('Missing householdId');
      }
      if (!contactId) {
        throw new Error('Missing contactId');
      }

      const contactData = buildContactPayload(formData);
      logger.info('Submitting edited contact data to API', { contactId, contactData });

      const result = await submitContactToApi(c, 'PATCH', `/api/contacts/${encodeURIComponent(contactId)}`, contactData);
      logger.info('Contact updated successfully', { contactId: result.id || contactId });

      return c.redirect(buildRedirectTarget(householdId, returnTo));
    } catch (error) {
      logger.error(error, 'Error processing contact edit form:');

      const query = [];
      if (householdId) {
        query.push(`householdId=${encodeURIComponent(householdId)}`);
      }
      if (contactId) {
        query.push(`contactId=${encodeURIComponent(contactId)}`);
      }
      const retryHref = `/record-contact.html${query.length > 0 ? `?${query.join('&')}` : ''}`;

      return c.html(renderErrorPage(error.message, retryHref), 500);
    }
  });
}
