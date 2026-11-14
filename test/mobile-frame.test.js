import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { runInNewContext } from 'vm'
import { createApp } from '../src/api.js'

function renderMobileLink({ embedded = true, coarse = true, width = 390 } = {}) {
  const links = []
  const window = {
    self: {},
    top: {},
    innerWidth: 980,
    location: { href: 'https://app.example.test/help.html?page=login' },
    matchMedia: () => ({ matches: coarse }),
    addEventListener: () => {}
  }
  if (!embedded) window.top = window.self
  const document = {
    createElement: () => ({ style: { setProperty: () => {} } }),
    body: { appendChild: link => links.push(link) },
    addEventListener: (event, callback) => callback()
  }
  runInNewContext(readFileSync('site/mobile-frame.js', 'utf8'), {
    window, document, screen: { width, height: 844 }
  })
  return links
}

describe('mobile frame script', () => {
  it('is included in static and rendered HTML pages', async () => {
    const app = createApp()
    for (const path of ['/email-login.html', '/help.html?page=login']) {
      const response = await app.request(path)
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain('<script defer src="/mobile-frame.js"></script>')
    }
  })

  it('serves the shared script', async () => {
    const response = await createApp().request('/mobile-frame.js')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/javascript')
  })

  it('links embedded mobile visitors to the current page in the top window', () => {
    const links = renderMobileLink()
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({
      href: 'https://app.example.test/help.html?page=login',
      target: '_top',
      textContent: 'Open mobile site'
    })
  })

  it('does not show the link for direct or desktop visitors', () => {
    expect(renderMobileLink({ embedded: false })).toHaveLength(0)
    expect(renderMobileLink({ coarse: false, width: 1440 })).toHaveLength(0)
  })
})
