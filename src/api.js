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
      
      // Add timestamp and generate ID
      const memberData = {
        ...body,
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
      
      // Add timestamp and generate ID
      const contactData = {
        ...body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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

  // Deacon assignments endpoint
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
