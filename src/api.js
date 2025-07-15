import { Hono } from 'hono'
import { SengoClient } from 'sengo'

// Initialize sengo client for S3 data storage
const sengo = new SengoClient({
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET || 'deacon-care-system',
  // Note: In production, use proper AWS credentials
  // For local development, you can use AWS CLI credentials
})

export function createApp() {
  const app = new Hono()

  // Health check endpoint
  app.get('/', (c) => {
    return c.json({ 
      message: 'Deacon Care System API',
      status: 'healthy',
      timestamp: new Date().toISOString()
    })
  })

  // Hello world endpoint
  app.get('/hello', (c) => {
    return c.json({ 
      message: 'Hello from Deacon Care System!',
      version: '1.0.0'
    })
  })

  // API endpoints for the deacon care system
  app.get('/api/members', async (c) => {
    try {
      // Get all members from S3 using sengo
      const members = await sengo.db().collection('members').find().toArray()
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
      const result = await sengo.db().collection('members').insertOne(memberData)
      
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
      const households = await sengo.db().collection('households').find().toArray()
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
      const result = await sengo.db().collection('households').insertOne(householdData)
      
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
      const contacts = await sengo.db().collection('contacts').find().toArray()
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
      const result = await sengo.db().collection('contacts').insertOne(contactData)
      
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
      const deacons = await sengo.db().collection('deacons').find().toArray()
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
      const result = await sengo.db().collection('deacons').insertOne(deaconData)
      
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
      const assignments = await sengo.db().collection('assignments').find().toArray()
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
      const result = await sengo.db().collection('assignments').insertOne(assignmentData)
      
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
      const assignments = await sengo.db().collection('assignments')
        .find({ deaconId })
        .toArray()
      
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
      const members = await sengo.db().collection('members')
        .find({ householdId })
        .toArray()
      
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
      const contacts = await sengo.db().collection('contacts')
        .find({ memberId })
        .toArray()
      
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

  // Error handling
  app.onError((err, c) => {
    console.error('Error:', err)
    return c.json({ 
      error: 'Internal Server Error',
      message: err.message 
    }, 500)
  })

  // 404 handler
  app.notFound((c) => {
    return c.json({ 
      error: 'Not Found',
      message: 'The requested endpoint was not found'
    }, 404)
  })

  return app
}
