import { Hono } from 'hono'
import { readFileSync } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import registerMemberRoutes from './api/members.js'
import registerHouseholdRoutes from './api/households.js'
import registerAssignmentRoutes from './api/assignments.js'
import registerDeaconRoutes from './api/deacons.js'
import registerContactRoutes from './api/contacts.js'
import registerCommonLocationRoutes from './api/common-locations.js'
import registerEventRoutes from './api/events.js'
import registerEmailLoginRoutes from './auth/email-login.js'
import registerContactFormRoutes from './form/contact-form.js'
import { safeCollectionFind } from './util/helpers.js'
import logger, {getLogger, follow, addContexts, addContext } from './util/logger.js';
import { statSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Cache the deployment time (run once)
let deploymentTime;
try {
  const stats = statSync(__filename);
  deploymentTime = stats.mtime.toUTCString();
} catch {
  deploymentTime = new Date().toUTCString();
}

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
}

// Static file serving middleware
async function serveStatic(c, filePath) {
  try {
    const siteDir = join(__dirname, '..', 'site')
    const fullPath = join(siteDir, filePath)

    // Security check - ensure file is within site directory
    if (!fullPath.startsWith(siteDir)) {
      return c.text('403 Forbidden', 403)
    }

    const content = readFileSync(fullPath)
    const ext = extname(filePath).toLowerCase()
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    c.header('Content-Type', contentType)
    c.header('Cache-Control', 'public, max-age=300') // Cache for 5 minutes
    // when the lambda was last deployed
    c.header("Last-Modified", deploymentTime);
    return c.body(content)
  } catch (error) {
    getLogger().error(error, 'Error serving static file:');
    if (error.code === 'ENOENT') {
      return c.text('404 Not Found', 404)
    }
    return c.text('500 Internal Server Error', 500)
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function readSiteTemplate(filePath) {
  const siteDir = join(__dirname, '..', 'site')
  const fullPath = join(siteDir, filePath)
  return readFileSync(fullPath, 'utf8')
}

function canSeeSignUps(role) {
  return ['deacon', 'staff', 'elder', 'usher'].includes(role)
}

function canScheduleEvents(role) {
  return ['deacon', 'staff'].includes(role)
}

function canViewAssignments(role) {
  return ['deacon', 'staff'].includes(role)
}

function normalizeRoleList(roles) {
  if (!Array.isArray(roles)) {
    return []
  }
  return roles
    .map(role => String(role || '').trim())
    .filter(Boolean)
}

async function getEventsNavVisibility(role) {
  if (!role) {
    return {
      showSignUpsLink: false,
      showScheduleLink: false
    }
  }

  try {
    const [eventTypes, calendarEntries] = await Promise.all([
      safeCollectionFind('event_types', { isActive: true }),
      safeCollectionFind('event_calendar')
    ])

    const todayIsoDate = new Date().toISOString().split('T')[0]
    const activeEventTypes = Array.isArray(eventTypes) ? eventTypes : []

    const signUpEventTypes = new Set(
      activeEventTypes
        .filter(typeDoc => normalizeRoleList(typeDoc.allowedRoles).includes(role))
        .map(typeDoc => String(typeDoc.eventType || '').trim())
        .filter(Boolean)
    )

    const hasSchedulableEventTypes = activeEventTypes.some(typeDoc =>
      normalizeRoleList(typeDoc.assignmentRoles).includes(role)
    )

    const hasFutureScheduledEvents = Array.isArray(calendarEntries)
      && calendarEntries.some(entry => {
        const entryDate = String(entry.serviceDate || '')
        const entryType = String(entry.eventType || '').trim()
        return entryDate > todayIsoDate && signUpEventTypes.has(entryType)
      })

    return {
      showSignUpsLink: signUpEventTypes.size > 0 && hasFutureScheduledEvents,
      showScheduleLink: hasSchedulableEventTypes
    }
  } catch (error) {
    getLogger().warn(error, 'Failed to load event nav visibility from database; falling back to role-only visibility.')
    return {
      showSignUpsLink: canSeeSignUps(role),
      showScheduleLink: canScheduleEvents(role)
    }
  }
}

function renderRoleAwareHomePage(role, visibility = {}) {
  const template = readSiteTemplate('index.html')
  const links = []
  if (canSeeSignUps(role)) {
    links.push('<a href="/sign-ups.html">Sign Ups</a>')
  }
  if (visibility.showScheduleLink === true) {
    links.push('<a href="/event-schedule.html">Schedule Event</a>')
  }

  const secondaryLinks = links.length > 0
    ? `
        <div style="margin-top:16px; text-align:center; color:#666; font-size:0.95em;">
            <span style="margin-right:8px;">Quick Link:</span>
            ${links.join(' | ')}
        </div>`
    : ''

  return template.replace('<!--HOME_SECONDARY_LINKS-->', secondaryLinks)
}

function renderRoleAwareSignUpsPage(role) {
  const template = readSiteTemplate('sign-ups.html')
  const assignmentsAccessScript = `<script>window.__CAN_VIEW_ASSIGNMENTS__ = ${canViewAssignments(role) ? 'true' : 'false'};</script>`
  return template
    .replace('<!--ASSIGNMENTS_ACCESS_SCRIPT-->', assignmentsAccessScript)
}

function renderRoleAwareSiteNav(role, visibility = {}) {
  const template = readSiteTemplate('site-nav.html')
  const showSignUpsLink = visibility.showSignUpsLink === true
  const showScheduleLink = visibility.showScheduleLink === true

  const desktopLink = showSignUpsLink
    ? '<a href="/sign-ups.html" class="nav-link sign-ups-link" title="Sign Ups"><span>✅</span> Sign Ups</a>'
    : ''
  const desktopScheduleLink = ''
  const mobileLink = showSignUpsLink
    ? '<a href="/sign-ups.html" class="nav-link sign-ups-link" title="Sign Ups"><span>✅</span> Sign Ups</a>'
    : ''
  const mobileScheduleLink = showScheduleLink
    ? '<a href="/event-schedule.html" class="nav-link schedule-event-link" title="Schedule Event"><span>🗓️</span> Schedule Event</a>'
    : ''

  return template
    .replace('<!--SIGN_UPS_NAV_LINK_DESKTOP-->', desktopLink)
    .replace('<!--SCHEDULE_EVENT_NAV_LINK_DESKTOP-->', desktopScheduleLink)
    .replace('<!--SIGN_UPS_NAV_LINK_MOBILE-->', mobileLink)
    .replace('<!--SCHEDULE_EVENT_NAV_LINK_MOBILE-->', mobileScheduleLink)
}

export function createApp() {
  const app = new Hono()


  registerEmailLoginRoutes(app)
  // registerOidcRoutes(app)

  // Form routes (must be after auth middleware)
  registerContactFormRoutes(app)

  /**
   * @route GET /api
   * @description Health/status endpoint for the API service.
   * @usedByPage None found.
   * @usedByScript None found.
   */
  app.get('/api', (c) => {
    addContext('routeType', 'health');
    return c.json({
      message: 'Deacon Care System API',
      status: 'healthy',
      timestamp: new Date().toISOString()
    })
  })
  
  app.use('/api/*', async (c, next) => {
    addContext('routeType', 'api');
    return await next();
  });

  registerMemberRoutes(app)
  registerHouseholdRoutes(app)
  registerAssignmentRoutes(app)
  registerDeaconRoutes(app)
  registerContactRoutes(app)
  registerCommonLocationRoutes(app)
  registerEventRoutes(app)

  app.get('/site-nav.html', async (c) => {
    addContext('routeType', 'static');
    const role = c.req.role || null
    const visibility = await getEventsNavVisibility(role)
    const html = renderRoleAwareSiteNav(role, visibility)
    c.header('Content-Type', 'text/html')
    // Role-aware and database-driven: must not be served from shared cache.
    c.header('Cache-Control', 'private, no-store, max-age=0')
    c.header('Pragma', 'no-cache')
    c.header('Vary', 'Cookie')
    c.header('Last-Modified', deploymentTime)
    return c.html(html)
  })

  app.get('/sign-ups.html', async (c) => {
    addContext('routeType', 'static');
    const role = c.req.role || null
    if (!canSeeSignUps(role)) {
      return c.redirect('/')
    }

    const html = renderRoleAwareSignUpsPage(role)
    // Role-aware content must not be shared across users.
    c.header('Cache-Control', 'private, no-store, max-age=0')
    c.header('Pragma', 'no-cache')
    c.header('Vary', 'Cookie')
    c.header('Last-Modified', deploymentTime)
    return c.html(html)
  })

  app.get('/event-schedule.html', async (c) => {
    addContext('routeType', 'static');
    const role = c.req.role || null
    if (!canScheduleEvents(role)) {
      return c.redirect('/sign-ups.html')
    }

    c.header('Cache-Control', 'public, max-age=300')
    c.header('Last-Modified', deploymentTime)
    return await serveStatic(c, 'event-schedule.html')
  })

  app.get('/event-assignments.html', async (c) => {
    addContext('routeType', 'static');
    const role = c.req.role || null
    if (!canViewAssignments(role)) {
      return c.redirect('/')
    }

    c.header('Cache-Control', 'public, max-age=300')
    c.header('Last-Modified', deploymentTime)
    return await serveStatic(c, 'event-assignments.html')
  })

  // Help subdirectory — serves site/help/** for the help viewer
  app.get('/help/*', async (c) => {
    addContext('routeType', 'static');
    const filePath = c.req.path.slice(1) // strip leading /
    const allowedExtensions = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.json', '.md']
    const ext = extname(filePath).toLowerCase()
    if (allowedExtensions.includes(ext)) {
      return await serveStatic(c, filePath)
    }
    return c.text('404 Not Found', 404)
  })

  app.options('/:filename', (c) => {
    addContext('routeType', 'static');
    const ifModifiedSince = c.req.header('If-Modified-Since');
    if(ifModifiedSince) {
      const sinceModified = new Date(ifModifiedSince);
      const deployedDate = new Date(deploymentTime);
      if(!isNaN(sinceModified.getTime()) && deployedDate <= sinceModified) {
        return c.text('', 304);
      }
    }
    return c.text('', 200);
  });

  app.get('/', async (c) => {
    addContext('routeType', 'index');
    const role = c.req.role || null
    const visibility = await getEventsNavVisibility(role)
    const html = renderRoleAwareHomePage(role, visibility)
    c.header('Cache-Control', 'public, max-age=300')
    c.header('Last-Modified', deploymentTime)
    return c.html(html)
  })

  app.get('/index.html', async (c) => {
    addContext('routeType', 'index');
    const role = c.req.role || null
    const visibility = await getEventsNavVisibility(role)
    const html = renderRoleAwareHomePage(role, visibility)
    c.header('Cache-Control', 'public, max-age=300')
    c.header('Last-Modified', deploymentTime)
    return c.html(html)
  })

  // Generic static file handler for other assets
  app.get('/:filename', async (c) => {
    addContext('routeType', 'static');
    const filename = c.req.param('filename')
    // Only serve specific file types for security
    const allowedExtensions = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.json']
    const ext = extname(filename).toLowerCase()

    if (allowedExtensions.includes(ext)) {
      return await serveStatic(c, filename)
    }

    return c.text('404 Not Found', 404)
  })

  // Error handling
  app.onError((err, c) => {
    logger.error(err, 'Error:')
    return c.json({
      error: 'Internal Server Error',
      message: err.message
    }, 500)
  })

  // 404 handler for unmatched routes
  app.notFound((c) => {
    return c.json({
      error: 'Not Found',
      message: 'The requested endpoint was not found',
      method: c.req.method,
      url: c.req.url
    }, 404)
  })

  return app
}
