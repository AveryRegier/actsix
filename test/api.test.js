import { test, expect } from 'vitest'

test('basic test to verify setup', () => {
  expect(1 + 1).toBe(2)
})

test('hono import works', async () => {
  const { Hono } = await import('hono')
  expect(typeof Hono).toBe('function')
})

test('sengo import works', async () => {
  const { SengoClient } = await import('sengo')
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
  const { SengoClient } = await import('sengo')
  
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
  
  // Test health check (now at /api)
  const healthResponse = await app.request('/api')
  const healthJson = await healthResponse.json()
  
  expect(healthJson.message).toBe('Deacon Care System API')
  expect(healthJson.status).toBe('healthy')
  
  // Test hello endpoint (now at /api/hello)
  const helloResponse = await app.request('/api/hello')
  const helloJson = await helloResponse.json()
  
  expect(helloJson.message).toBe('Hello from Deacon Care System!')
  expect(helloJson.version).toBe('1.0.0')
  
  // Test that root path serves HTML (not JSON)
  const rootResponse = await app.request('/')
  const rootText = await rootResponse.text()
  
  expect(rootText).toContain('<!DOCTYPE html>')
  expect(rootText).toContain('Deacon Care System')
}, 10000) // 10 second timeout
