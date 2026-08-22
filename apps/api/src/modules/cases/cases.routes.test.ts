import type { AwilixContainer } from 'awilix'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import type { Cradle } from '../../container.js'
import type { AppEnvironment } from '../../http-types.js'
import type { ExecutionContext } from '../../platform/execution/context.js'
import { createCasesRoutes } from './cases.routes.js'
import type { CasesService } from './cases.service.js'

const statuses = ['new', 'postponed', 'working', 'waiting', 'resolved', 'canceled'] as const

describe('case list HTTP contract', () => {
  it('accepts all statuses together with a status group as an intersection', async () => {
    const list = vi.fn<CasesService['list']>().mockResolvedValue({ items: [], nextCursor: null })
    const app = testApp(list)
    const query = new URLSearchParams()
    for (const status of statuses) query.append('status', status)
    query.set('statusGroup', 'open')

    const response = await app.request(`/cases?${query}`)

    expect(response.status).toBe(200)
    expect(list).toHaveBeenCalledWith({ status: statuses, statusGroup: 'open' }, executionContext)
  })

  it('rejects more status values than the shared contract allows', async () => {
    const list = vi.fn<CasesService['list']>().mockResolvedValue({ items: [], nextCursor: null })
    const app = testApp(list)
    const query = new URLSearchParams()
    for (const status of [...statuses, 'new'] as const) query.append('status', status)

    const response = await app.request(`/cases?${query}`)

    expect(response.status).toBe(400)
    expect(list).not.toHaveBeenCalled()
  })
})

function testApp(list: CasesService['list']) {
  const scope = {
    resolve(name: keyof Cradle) {
      if (name === 'casesService') return { list }
      throw new Error(`Unexpected dependency: ${name}`)
    },
  } as unknown as AwilixContainer<Cradle>
  const app = new Hono<AppEnvironment>()
  app.use('*', async (context, next) => {
    context.set('executionContext', executionContext)
    context.set('scope', scope)
    await next()
  })
  app.route('/cases', createCasesRoutes())
  return app
}

const executionContext: ExecutionContext = {
  actor: { id: 'test-user', type: 'user' },
  capabilities: new Set(['cases.read']),
  correlationId: 'correlation-id',
  organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
  requestId: 'request-id',
}
