import { describe, expect, it } from 'vitest'

import { createApp } from './app.js'

describe('API application without runtime services', () => {
  const app = createApp()

  it('exports OpenAPI without starting PostgreSQL', async () => {
    const response = await app.request('/api/openapi.json')
    const document = await response.json()

    expect(response.status).toBe(200)
    expect(document.openapi).toBe('3.1.0')
    expect(document.paths).toHaveProperty('/api/v1/health')
  })

  it('keeps liveness independent from the database', async () => {
    const response = await app.request('/health/live')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  it('reports unavailable runtime for database-backed routes', async () => {
    const response = await app.request('/api/v1/health')
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain('application/problem+json')
    expect(body).toMatchObject({ status: 503, title: 'Service Unavailable' })
  })
})
