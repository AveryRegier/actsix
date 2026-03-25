import { test, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

test('basic test to verify setup', () => {
  expect(1 + 1).toBe(2)
})

test('hono import works', async () => {
  const { Hono } = await import('hono')
  expect(typeof Hono).toBe('function')
})

test('sengo import works', async () => {
  const { SengoClient } = require('sengo')
  expect(typeof SengoClient).toBe('function')
}, 10000) // 10 second timeout

test('can create hono app', async () => {
  const { Hono } = await import('hono')
  const app = new Hono()
  
  app.get('/', (c) => c.json({ message: 'test' }))
  
  const res = await app.request('/')
  const json = await res.json()
  
  expect(json.message).toBe('test')
})

test('can create sengo client', async () => {
  const { SengoClient } = require('sengo')
  
  const client = new SengoClient({
    region: 'us-east-1',
    bucket: 'test-bucket'
  })
  
  expect(client).toBeDefined()
  expect(typeof client.db).toBe('function')
  
  const db = client.db()
  expect(typeof db.collection).toBe('function')
}, 10000) // 10 second timeout

test('can import lambda handler from src', async () => {
  const lambdaModule = await import('../src/lambda.js')
  expect(lambdaModule.handler).toBeDefined()
  expect(typeof lambdaModule.handler).toBe('function')
}, 10000) // 10 second timeout

test('can import createApp function from api', async () => {
  const { createApp } = await import('../src/api.js')
  expect(typeof createApp).toBe('function')
  
  const app = createApp()
  expect(app).toBeDefined()
}, 10000) // 10 second timeout

test('api endpoints work correctly', async () => {
  const { createApp } = await import('../src/api.js')
  const app = createApp()
  process.env.GENERATION_API_KEY = 'test-generation-key'
  
  // Test health check route with generation key auth
  const healthResponse = await app.request('/api', {
    headers: {
      'x-api-key': 'test-generation-key'
    }
  })
  const healthJson = await healthResponse.json()
  
  expect(healthJson.message).toBe('Deacon Care System API')
  expect(healthJson.status).toBe('healthy')

  // Root path redirects to login when unauthenticated
  const rootResponse = await app.request('/')

  expect(rootResponse.status).toBe(302)
  expect(rootResponse.headers.get('location')).toContain('/email-login.html')
}, 10000) // 10 second timeout
