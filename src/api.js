import { Hono } from 'hono'
import { SengoClient } from 'sengo'
import { readFileSync } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize sengo client for S3 data storage
const sengo = new SengoClient({
  logger: { level: 'info' }
})

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

// Helper function to safely get collection data
async function safeCollectionFind(collectionName, query = {}) {
  try {
    const collection = sengo.db(process.env.S3_BUCKET || 'deacon-care-system').collection(collectionName)
    const result = await collection.find(query).toArray()
    return result || []
  } catch (error) {
    console.error(`Error accessing collection ${collectionName}:`, error)
    // Return empty array if collection doesn't exist or has issues
    return []
  }
}

// Helper function to safely insert into collection
async function safeCollectionInsert(collectionName, data) {
  try {
    const collection = sengo.db(process.env.S3_BUCKET || 'deacon-care-system').collection(collectionName)
    const result = await collection.insertOne(data)
    return result
  } catch (error) {
    console.error(`Error inserting into collection ${collectionName}:`, error)
    throw error
  }
}

export function createApp() {
  const app = new Hono()

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

  // API endpoints for the deacon care system
  app.get('/api/members', async (c) => {
    try {
      // Get all members from S3 using sengo
      const members = await safeCollectionFind('members')
      return c.json({ 
        members,
        count: members.length
      })
    } catch (error) {
      console.error('Error fetching members:', error)
      return c.json({ 
        error: 'Failed to fetch members',
        message: error.message 
      }, 500)
    }
  })

  app.post('/api/members', async (c) => {
    try {
      const body = await c.req.json()
      
      // Validate required fields according to schema
      const requiredFields = ['firstName', 'lastName', 'householdId', 'relationship']
      for (const field of requiredFields) {
        if (!body[field]) {
          return c.json({ 
            error: 'Validation failed',
            message: `Missing required field: ${field}`
          }, 400)
        }
      }
      
      // Validate relationship enum
      const validRelationships = ['head', 'spouse', 'child', 'other']
      if (!validRelationships.includes(body.relationship)) {
        return c.json({ 
          error: 'Validation failed',
          message: `Invalid relationship. Must be one of: ${validRelationships.join(', ')}`
        }, 400)
      }
      
      // Validate status enum if provided
      if (body.status) {
        const validStatuses = ['active', 'inactive', 'deceased', 'moved']
        if (!validStatuses.includes(body.status)) {
          return c.json({ 
            error: 'Validation failed',
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
          }, 400)
        }
      }
      
      // Add timestamp and default values
      const memberData = {
        ...body,
        status: body.status || 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // Insert member into S3 using sengo
      const result = await safeCollectionInsert('members', memberData)
      
      return c.json({ 
        message: 'Member created successfully',
        id: result.insertedId,
        member: memberData
      })
    } catch (error) {
      console.error('Error creating member:', error)
      return c.json({ 
        error: 'Failed to create member',
        message: error.message 
      }, 500)
    }
  })

  app.get('/api/households', async (c) => {
    try {
      // Get all households from S3 using sengo
      const households = await safeCollectionFind('households')
      return c.json({ 
        households,
        count: households.length
      })
    } catch (error) {
      console.error('Error fetching households:', error)
      return c.json({ 
        error: 'Failed to fetch households',
        message: error.message 
      }, 500)
    }
  })

  app.post('/api/households', async (c) => {
    try {
      const body = await c.req.json()
      
      // Validate required fields according to schema
      const requiredFields = ['lastName', 'address', 'primaryPhone']
      for (const field of requiredFields) {
        if (!body[field]) {
          return c.json({ 
            error: 'Validation failed',
            message: `Missing required field: ${field}`
          }, 400)
        }
      }
      
      // Validate address structure
      if (!body.address || typeof body.address !== 'object') {
        return c.json({ 
          error: 'Validation failed',
          message: 'Address must be an object'
        }, 400)
      }
      
      const requiredAddressFields = ['street', 'city', 'state', 'zipCode']
      for (const field of requiredAddressFields) {
        if (!body.address[field]) {
          return c.json({ 
            error: 'Validation failed',
            message: `Missing required address field: ${field}`
          }, 400)
        }
      }
      
      // Add timestamp and generate ID
      const householdData = {
        ...body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // Insert household into S3 using sengo
      const result = await safeCollectionInsert('households', householdData)
      
      return c.json({ 
        message: 'Household created successfully',
        id: result.insertedId,
        household: householdData
      })
    } catch (error) {
      console.error('Error creating household:', error)
      return c.json({ 
        error: 'Failed to create household',
        message: error.message 
      }, 500)
    }
  })

  // Contact log endpoints
  app.get('/api/contacts', async (c) => {
    try {
      // Get all contact logs from S3 using sengo
      const contacts = await safeCollectionFind('contacts')
      return c.json({ 
        contacts,
        count: contacts.length
      })
    } catch (error) {
      console.error('Error fetching contacts:', error)
      return c.json({ 
        error: 'Failed to fetch contacts',
        message: error.message 
      }, 500)
    }
  })

  app.post('/api/contacts', async (c) => {
    try {
      const body = await c.req.json()
      
      // Validate required fields according to schema
      const requiredFields = ['memberId', 'deaconId', 'contactType', 'summary', 'contactDate']
      for (const field of requiredFields) {
        if (!body[field]) {
          return c.json({ 
            error: 'Validation failed',
            message: `Missing required field: ${field}`
          }, 400)
        }
      }
      
      // Validate contactType enum
      const validContactTypes = ['phone', 'visit', 'email', 'text']
      if (!validContactTypes.includes(body.contactType)) {
        return c.json({ 
          error: 'Validation failed',
          message: `Invalid contactType. Must be one of: ${validContactTypes.join(', ')}`
        }, 400)
      }
      
      // Add timestamp and generate ID
      const contactData = {
        ...body,
        followUpRequired: body.followUpRequired || false,
        createdAt: new Date().toISOString()
      }
      
      // Insert contact log into S3 using sengo
      const result = await safeCollectionInsert('contacts', contactData)
      
      return c.json({ 
        message: 'Contact log created successfully',
        id: result.insertedId,
        contact: contactData
      })
    } catch (error) {
      console.error('Error creating contact log:', error)
      return c.json({ 
        error: 'Failed to create contact log',
        message: error.message 
      }, 500)
    }
  })

  // Deacon endpoints
  app.get('/api/deacons', async (c) => {
    try {
      // Get all deacons from S3 using sengo
      const deacons = await safeCollectionFind('deacons')
      return c.json({ 
        deacons,
        count: deacons.length
      })
    } catch (error) {
      console.error('Error fetching deacons:', error)
      return c.json({ 
        error: 'Failed to fetch deacons',
        message: error.message 
      }, 500)
    }
  })

  app.post('/api/deacons', async (c) => {
    try {
      const body = await c.req.json()
      
      // Validate required fields according to schema
      const requiredFields = ['firstName', 'lastName', 'email', 'phone']
      for (const field of requiredFields) {
        if (!body[field]) {
          return c.json({ 
            error: 'Validation failed',
            message: `Missing required field: ${field}`
          }, 400)
        }
      }
      
      // Add timestamp and default values
      const deaconData = {
        ...body,
        isActive: body.isActive !== undefined ? body.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // Insert deacon into S3 using sengo
      const result = await safeCollectionInsert('deacons', deaconData)
      
      return c.json({ 
        message: 'Deacon created successfully',
        id: result.insertedId,
        deacon: deaconData
      })
    } catch (error) {
      console.error('Error creating deacon:', error)
      return c.json({ 
        error: 'Failed to create deacon',
        message: error.message 
      }, 500)
    }
  })

  // Assignment endpoints
  app.get('/api/assignments', async (c) => {
    try {
      // Get all assignments from S3 using sengo
      const assignments = await safeCollectionFind('assignments')
      return c.json({ 
        assignments,
        count: assignments.length
      })
    } catch (error) {
      console.error('Error fetching assignments:', error)
      return c.json({ 
        error: 'Failed to fetch assignments',
        message: error.message 
      }, 500)
    }
  })

  app.post('/api/assignments', async (c) => {
    try {
      const body = await c.req.json()
      
      // Validate required fields according to schema
      const requiredFields = ['deaconId', 'householdId']
      for (const field of requiredFields) {
        if (!body[field]) {
          return c.json({ 
            error: 'Validation failed',
            message: `Missing required field: ${field}`
          }, 400)
        }
      }
      
      // Add timestamp and default values
      const assignmentData = {
        ...body,
        isActive: body.isActive !== undefined ? body.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // Insert assignment into S3 using sengo
      const result = await safeCollectionInsert('assignments', assignmentData)
      
      return c.json({ 
        message: 'Assignment created successfully',
        id: result.insertedId,
        assignment: assignmentData
      })
    } catch (error) {
      console.error('Error creating assignment:', error)
      return c.json({ 
        error: 'Failed to create assignment',
        message: error.message 
      }, 500)
    }
  })

  // Deacon assignments endpoint (specific deacon's assignments)
  app.get('/api/deacons/:deaconId/assignments', async (c) => {
    try {
      const deaconId = c.req.param('deaconId')
      
      // Get assignments for specific deacon from S3 using sengo
      const assignments = await safeCollectionFind('assignments', { deaconId })
      
      return c.json({ 
        deaconId,
        assignments,
        count: assignments.length
      })
    } catch (error) {
      console.error('Error fetching deacon assignments:', error)
      return c.json({ 
        error: 'Failed to fetch deacon assignments',
        message: error.message 
      }, 500)
    }
  })

  // Household members endpoint (get all members of a household)
  app.get('/api/households/:householdId/members', async (c) => {
    try {
      const householdId = c.req.param('householdId')
      
      // Get members for specific household from S3 using sengo
      const members = await safeCollectionFind('members', { householdId })
      
      return c.json({ 
        householdId,
        members,
        count: members.length
      })
    } catch (error) {
      console.error('Error fetching household members:', error)
      return c.json({ 
        error: 'Failed to fetch household members',
        message: error.message 
      }, 500)
    }
  })

  // Member contacts endpoint (get all contacts for a specific member)
  app.get('/api/members/:memberId/contacts', async (c) => {
    try {
      const memberId = c.req.param('memberId')
      
      // Get contacts for specific member from S3 using sengo
      const contacts = await safeCollectionFind('contacts', { memberId })
      
      return c.json({ 
        memberId,
        contacts,
        count: contacts.length
      })
    } catch (error) {
      console.error('Error fetching member contacts:', error)
      return c.json({ 
        error: 'Failed to fetch member contacts',
        message: error.message 
      }, 500)
    }
  })

  // Static file serving routes (serve the site)
  app.get('/', async (c) => {
    return await serveStatic(c, 'index.html')
  })

  app.get('/deacons.html', async (c) => {
    return await serveStatic(c, 'deacons.html')
  })

  app.get('/favicon.ico', async (c) => {
    return await serveStatic(c, 'favicon.ico')
  })

  // Generic static file handler for other assets
  app.get('/:filename', async (c) => {
    const filename = c.req.param('filename')
    // Only serve specific file types for security
    const allowedExtensions = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico']
    const ext = extname(filename).toLowerCase()
    
    if (allowedExtensions.includes(ext)) {
      return await serveStatic(c, filename)
    }
    
    return c.text('404 Not Found', 404)
  })

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
      message: 'The requested endpoint was not found'
    }, 404)
  })

  return app
}
