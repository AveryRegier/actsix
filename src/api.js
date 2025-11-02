import { Hono } from 'hono'
import { readFileSync } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import registerMemberRoutes from './api/members.js'
import registerHouseholdRoutes from './api/households.js'
import registerAssignmentRoutes from './api/assignments.js'
import registerDeaconRoutes from './api/deacons.js'
import registerContactRoutes from './api/contacts.js'
// import registerOidcRoutes from './api/oidc.js'
import registerEmailLoginRoutes from './api/email-login.js'

// import { logger } from "./logger.js";
import jwt from 'jsonwebtoken';
import qs from 'qs';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { safeCollectionFind } from './helpers.js';
import logger, {getLogger, follow, addContexts, addContext } from './logger.js';
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
  '.ico': 'image/x-icon'
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
    return c.body(content)
  } catch (error) {
    getLogger().error(error, 'Error serving static file:');
    if (error.code === 'ENOENT') {
      return c.text('404 Not Found', 404)
    }
    return c.text('500 Internal Server Error', 500)
  }
}

export function createApp() {
  const app = new Hono()


  registerEmailLoginRoutes(app)
  // registerOidcRoutes(app)
  registerMemberRoutes(app)
  registerHouseholdRoutes(app)
  registerAssignmentRoutes(app)
  registerDeaconRoutes(app)
  registerContactRoutes(app)

  // API Health check endpoint
  app.get('/api', (c) => {
    return c.json({
      message: 'Deacon Care System API',
      status: 'healthy',
      timestamp: new Date().toISOString()
    })
  })

  // Hello world endpoint
  app.get('/api/hello', (c) => {
    return c.json({
      message: 'Hello from Deacon Care System!',
      version: '1.0.0'
    })
  })
  
  // Static file serving routes (serve the site)
  app.get('/', async (c) => {
    return await serveStatic(c, 'index.html')
  })

  app.get('/deacons.html', async (c) => {
    return await serveStatic(c, 'deacons.html')
  })

  app.get('/household.html', async (c) => {
    return await serveStatic(c, 'household.html')
  })

  app.get('/favicon.ico', async (c) => {
    return await serveStatic(c, 'favicon.ico')
  })

  // Generic static file handler for other assets
  app.get('/:filename', async (c) => {
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
