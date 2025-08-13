import { Hono } from 'hono'
import { readFileSync } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import registerMemberRoutes from './api/members.js'
import registerHouseholdRoutes from './api/households.js'
import registerAssignmentRoutes from './api/assignments.js'
import registerDeaconRoutes from './api/deacons.js'
import registerContactRoutes from './api/contacts.js'
import { sengo } from './sengoClient.js'
import { logger } from "./logger.js";
import jwt from 'jsonwebtoken';

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
    if (error.code === 'ENOENT') {
      return c.text('404 Not Found', 404)
    }
    return c.text('500 Internal Server Error', 500)
  }
}

export function createApp() {
  const app = new Hono()

  // Middleware to log every request
  app.use('*', async (c, next) => {
    const logger = sengo.logger;

    // Extract JWT from Authorization header
    const authHeader = c.req.headers['authorization'];
    let memberId = null;
    let role = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7); // Remove 'Bearer '
      try {
        const decoded = jwt.decode(token);
        memberId = decoded['custom:member_id'];
        role = decoded['cognito:groups'] ? decoded['cognito:groups'][0] : null; // Extract the first group
        c.req.memberId = memberId; // Save memberId as an attribute on the request
        c.req.role = role; // Save cognitoGroup as an attribute on the request
      } catch (error) {
        logger?.warn({ error: error.message }, 'Failed to decode JWT');
      }
    }

    logger?.info({ method: c.req.method, url: c.req.url, memberId, role }, 'Incoming request');
    return next();
  });

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

  registerMemberRoutes(app)
  registerHouseholdRoutes(app)
  registerAssignmentRoutes(app)
  registerDeaconRoutes(app)
  registerContactRoutes(app)

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

  // Cognito callback route
  app.post('/cognito', async (c) => {
    try {
      const body = await c.req.json();
      logger.info({body}, 'Cognito callback received');

      // Extract the authorization code
      const { code } = body;
      if (!code) {
        return c.json({ error: 'Authorization code is missing' }, 400);
      }

      // Exchange the code for tokens
      const awsRegion = process.env.AWS_REGION || c.env.AWS_REGION;
      const tokenResponse = await fetch(`https://actsix.auth.${awsRegion}.amazoncognito.com/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.COGNITO_CLIENT_ID,
          code,
          redirect_uri: `https://${process.env.API_GATEWAY_URL}/cognito`,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        logger.error(error, 'Error exchanging code for tokens:');
        return c.json({ error: 'Failed to exchange code for tokens' }, 500);
      }

      const tokens = await tokenResponse.json();
      logger.info({tokens}, 'Tokens received:');

      // Validate the ID token (optional, for additional security)
      // You can use a library like `jsonwebtoken` to decode and verify the token
      const decodedToken = jwt.decode(tokens.id_token);
      const memberId = decodedToken['custom:member_id'];
      const role = decodedToken['cognito:groups'] ? decodedToken['cognito:groups'][0] : null;

      let member = await db.findOne('members', { _id: memberId });
      if (!member) {
        logger.warn({ memberId }, 'Member not found');
        return c.json({ error: 'Member not found' }, 401);
      }

      return c.json({ message: 'Cognito callback processed', tokens });
    } catch (error) {
      logger.error(error, 'Error handling Cognito callback');
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  });

  // Error handling
  app.onError((err, c) => {
    console.error('Error:', err)
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
