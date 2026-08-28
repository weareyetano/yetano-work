import type { AwilixContainer } from 'awilix'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import type { Cradle } from '../../container.js'
import type { AppEnvironment } from '../../http-types.js'
import type { ExecutionContext } from '../../platform/execution/context.js'
import { createActivitiesRoutes } from './activities.routes.js'
import { type ActivitiesService, ActivityIdConflictError } from './activities.service.js'

const caseId = '122c8615-6bcd-4a36-90e6-d18ca0c06928'
const activityId = '75bb9ef0-b103-4df7-89ce-efcbd2f79728'
const activity = {
  actorId: 'test-user',
  actorType: 'user' as const,
  caseId,
  content: 'Follow up tomorrow.',
  id: activityId,
  occurredAt: '2026-08-28T10:00:00.000Z',
  type: 'note' as const,
}

describe('activities HTTP contract', () => {
  it('lists one case timeline with validated pagination', async () => {
    const service = serviceMock()
    const app = testApp(service)

    const response = await app.request(`/activities/cases/${caseId}?limit=10&cursor=next`)

    expect(response.status).toBe(200)
    expect(service.list).toHaveBeenCalledWith(
      caseId,
      { cursor: 'next', limit: 10 },
      executionContext,
    )
  })

  it.each([
    { created: true, status: 201 },
    { created: false, status: 200 },
  ])('returns $status when created is $created', async ({ created, status }) => {
    const service = serviceMock()
    service.createNote.mockResolvedValue({ activity, created })
    const app = testApp(service)

    const response = await app.request(`/activities/cases/${caseId}/notes`, {
      body: JSON.stringify({ activityId, content: 'Follow up tomorrow.' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual(activity)
  })

  it('returns typed conflicts and rejects invalid bodies', async () => {
    const service = serviceMock()
    service.createNote.mockRejectedValue(
      new ActivityIdConflictError('The activity id has already been used for another note.'),
    )
    const app = testApp(service)

    const conflict = await app.request(`/activities/cases/${caseId}/notes`, {
      body: JSON.stringify({ activityId, content: 'Follow up tomorrow.' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    const invalid = await app.request(`/activities/cases/${caseId}/notes`, {
      body: JSON.stringify({ activityId, content: '   ' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toMatchObject({ code: 'activity_id_conflict' })
    expect(invalid.status).toBe(400)
  })
})

function serviceMock() {
  return {
    createNote: vi.fn<ActivitiesService['createNote']>(),
    list: vi.fn<ActivitiesService['list']>().mockResolvedValue({ items: [], nextCursor: null }),
  }
}

function testApp(service: ReturnType<typeof serviceMock>) {
  const scope = {
    resolve(name: keyof Cradle) {
      if (name === 'activitiesService') return service
      throw new Error(`Unexpected dependency: ${name}`)
    },
  } as unknown as AwilixContainer<Cradle>
  const app = new Hono<AppEnvironment>()
  app.use('*', async (context, next) => {
    context.set('executionContext', executionContext)
    context.set('requestId', executionContext.requestId)
    context.set('scope', scope)
    await next()
  })
  app.route('/activities', createActivitiesRoutes())
  return app
}

const executionContext: ExecutionContext = {
  actor: { id: 'test-user', type: 'user' },
  capabilities: new Set(['activities.create-note', 'activities.read', 'cases.read']),
  correlationId: 'correlation-id',
  organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
  requestId: 'request-id',
}
