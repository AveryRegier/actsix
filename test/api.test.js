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

test('lambda handler can process requests', async () => {
  const lambdaModule = await import('../src/lambda.js')
  
  // Create a mock Lambda event
  const event = {
    httpMethod: 'GET',
    path: '/',
    headers: {},
    body: null
  }
  
  const context = {}
  
  const response = await lambdaModule.handler(event, context)
  
  expect(response).toBeDefined()
  expect(response.statusCode).toBeDefined()
}, 10000) // 10 second timeout
