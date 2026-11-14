import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/api.js'

const originalHost = process.env.ALLOWED_FRAME_HOST

afterEach(() => {
  if (originalHost === undefined) delete process.env.ALLOWED_FRAME_HOST
  else process.env.ALLOWED_FRAME_HOST = originalHost
})

describe('frame-ancestors policy', () => {
  it('allows only the configured HTTPS host on login, redirects, and error responses', async () => {
    process.env.ALLOWED_FRAME_HOST = 'embed.example.test'
    const app = createApp()
    for (const path of ['/email-login.html', '/', '/missing.html']) {
      const response = await app.request(path)
      expect(response.headers.get('content-security-policy')).toBe('frame-ancestors https://embed.example.test')
    }
  })

  it('blocks framing when no host is configured', async () => {
    delete process.env.ALLOWED_FRAME_HOST
    const response = await createApp().request('/email-login.html')
    expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'none'")
  })

  it.each([
    'https://embed.example.test',
    'embed.example.test:443',
    'embed.example.test/path',
    '*.example.test',
    'embed.example.test; frame-ancestors *',
    'embed.example.test\n',
    'embed..example.test',
    'a'.repeat(64) + '.com'
  ])('rejects invalid host %s', host => {
    process.env.ALLOWED_FRAME_HOST = host
    expect(() => createApp()).toThrow('ALLOWED_FRAME_HOST must be a hostname')
  })
})
