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
import registerEmailLoginRoutes from './auth/email-login.js'
import registerContactFormRoutes from './form/contact-form.js'
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

export function createApp() {
  const app = new Hono()


  registerEmailLoginRoutes(app)
  // registerOidcRoutes(app)

  // Form routes (must be after auth middleware)
  registerContactFormRoutes(app)

  // API Health check endpoint
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

  // Static file serving routes (serve the site)
  app.get('/', async (c) => {
    addContext('routeType', 'index');
    return await serveStatic(c, 'index.html')
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
