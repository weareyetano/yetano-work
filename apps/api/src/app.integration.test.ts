import { EntityManager } from '@mikro-orm/core'
import { MikroORM } from '@mikro-orm/postgresql'
import type { Case, CaseStatusChange } from '@yetano/contracts'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from './app.js'
import type { AppConfig } from './config.js'
import { createRootContainer } from './container.js'
import { createOrmOptions } from './database.js'
import type { Logger } from './logger.js'
import type { ActorResolver } from './platform/execution/context.js'

const databaseUrl = process.env.TEST_DATABASE_URL
const describeWithDatabase = databaseUrl ? describe : describe.skip

describeWithDatabase('API with PostgreSQL', () => {
  let orm: Awaited<ReturnType<typeof MikroORM.init>>

  beforeAll(async () => {
    orm = await MikroORM.init(createOrmOptions({ databaseUrl: databaseUrl as string }))
    await orm.migrator.up()
  })

  beforeEach(async () => {
    await orm.em
      .getConnection()
      .execute('truncate table case_status_changes, cases, platform_outbox_events restart identity')
  })

  afterAll(async () => {
    await orm?.close(true)
  })

  it('returns readiness and typed API health', async () => {
    const app = createTestApp('ddbdc2cc-bbc9-4426-97bf-d99520983bbb')

    const readiness = await app.request('/health/ready')
    const health = await app.request('/api/v1/health')

    expect(readiness.status).toBe(200)
    expect(health.status).toBe(200)
    await expect(health.json()).resolves.toEqual({
      database: 'up',
      status: 'ok',
      version: 'test',
    })
  })

  it('keeps typed health public while protected case routes require an actor', async () => {
    const app = createTestApp('ddbdc2cc-bbc9-4426-97bf-d99520983bbb', {
      async resolve() {
        return null
      },
    })

    const health = await app.request('/api/v1/health')
    const cases = await app.request('/api/v1/cases')

    expect(health.status).toBe(200)
    expect(cases.status).toBe(401)
  })

  it('falls back to the request id when a correlation id exceeds the outbox column limit', async () => {
    const app = createTestApp('ddbdc2cc-bbc9-4426-97bf-d99520983bbb')
    const response = await app.request('/api/v1/cases', {
      body: JSON.stringify({ title: 'Bounded correlation' }),
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': 'x'.repeat(256),
      },
      method: 'POST',
    })

    expect(response.status).toBe(201)
    const requestId = response.headers.get('x-request-id')
    expect(requestId).toEqual(expect.any(String))
    const rows = await orm.em
      .getConnection()
      .execute<Array<{ correlation_id: string }>>(
        'select correlation_id from platform_outbox_events',
      )
    expect(rows).toEqual([{ correlation_id: requestId }])
  })

  it('keeps case data and emitted event scope inside the server-resolved organization', async () => {
    const firstOrganization = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb'
    const secondOrganization = '98b5d140-f720-4e64-89c3-59adc699cfe0'
    const firstApp = createTestApp(firstOrganization)

    const createResponse = await firstApp.request('/api/v1/cases', {
      body: JSON.stringify({ title: 'Customer cannot access their invoice' }),
      headers: {
        'content-type': 'application/json',
        'x-organization-id': secondOrganization,
      },
      method: 'POST',
    })
    const created = (await createResponse.json()) as Case

    expect(createResponse.status).toBe(201)
    expect(created.organizationId).toBe(firstOrganization)
    expect(created.status).toBe('new')
    expect(created.statusNote).toBeNull()

    const outboxRows = await orm.em
      .getConnection()
      .execute<Array<{ actor_id: string; organization_id: string; type: string }>>(
        'select actor_id, organization_id, type from platform_outbox_events',
      )
    expect(outboxRows).toEqual([
      {
        actor_id: 'local-dev',
        organization_id: firstOrganization,
        type: 'case.created',
      },
    ])

    const secondApp = createTestApp(secondOrganization)
    const crossOrganizationRead = await secondApp.request(`/api/v1/cases/${created.id}`)
    const crossOrganizationHistory = await secondApp.request(
      `/api/v1/cases/${created.id}/status-history`,
    )
    const secondOrganizationList = await secondApp.request('/api/v1/cases')

    expect(crossOrganizationRead.status).toBe(404)
    expect(crossOrganizationHistory.status).toBe(404)
    await expect(secondOrganizationList.json()).resolves.toEqual({ items: [], nextCursor: null })
  })

  it('rejects forged scope and stale mutations, and deduplicates lifecycle commands', async () => {
    const app = createTestApp('ddbdc2cc-bbc9-4426-97bf-d99520983bbb')
    const forgedScope = await app.request('/api/v1/cases', {
      body: JSON.stringify({
        organizationId: '98b5d140-f720-4e64-89c3-59adc699cfe0',
        title: 'Forged scope',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(forgedScope.status).toBe(400)

    const createResponse = await app.request('/api/v1/cases', {
      body: JSON.stringify({ title: 'Lifecycle test' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    const created = (await createResponse.json()) as Case

    const updateResponse = await app.request(`/api/v1/cases/${created.id}`, {
      body: JSON.stringify({ expectedVersion: created.version, title: 'Updated lifecycle test' }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    })
    const updated = (await updateResponse.json()) as Case
    expect(updated.version).toBe(created.version + 1)

    const staleUpdate = await app.request(`/api/v1/cases/${created.id}`, {
      body: JSON.stringify({ expectedVersion: created.version, title: 'Stale update' }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    })
    expect(staleUpdate.status).toBe(409)
    await expect(staleUpdate.json()).resolves.toMatchObject({
      code: 'case_version_conflict',
      currentVersion: updated.version,
    })

    const transitionId = crypto.randomUUID()
    const transition = () =>
      app.request(`/api/v1/cases/${created.id}/transition`, {
        body: JSON.stringify({
          expectedVersion: updated.version,
          fromStatus: 'new',
          toStatus: 'working',
          transitionId,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    const firstTransition = await transition()
    const stored = (await firstTransition.json()) as CaseStatusChange
    const repeatedTransition = await transition()
    const storedAgain = (await repeatedTransition.json()) as CaseStatusChange

    expect(firstTransition.status).toBe(200)
    expect(repeatedTransition.status).toBe(200)
    expect(storedAgain).toEqual(stored)
    const currentResponse = await app.request(`/api/v1/cases/${created.id}`)
    const current = (await currentResponse.json()) as Case
    expect(current).toMatchObject({ status: 'working', statusNote: null, version: 3 })

    const reusedId = await app.request(`/api/v1/cases/${created.id}/transition`, {
      body: JSON.stringify({
        expectedVersion: updated.version,
        fromStatus: 'new',
        note: 'Different command',
        toStatus: 'waiting',
        transitionId,
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(reusedId.status).toBe(409)
    await expect(reusedId.json()).resolves.toMatchObject({
      code: 'case_transition_id_conflict',
    })

    const historyResponse = await app.request(`/api/v1/cases/${created.id}/status-history`)
    const history = (await historyResponse.json()) as { items: CaseStatusChange[] }
    expect(history.items).toHaveLength(2)
    expect(history.items.map((entry) => entry.type)).toEqual(['transitioned', 'created'])

    const eventCounts = await orm.em
      .getConnection()
      .execute<Array<{ count: number; type: string }>>(
        'select type, count(*)::int as count from platform_outbox_events group by type order by type',
      )
    expect(eventCounts).toEqual([
      { count: 1, type: 'case.created' },
      { count: 1, type: 'case.transitioned' },
      { count: 1, type: 'case.updated' },
    ])
  })

  it('keeps concurrent lifecycle transitions idempotent', async () => {
    const app = createTestApp('ddbdc2cc-bbc9-4426-97bf-d99520983bbb')
    const createResponse = await app.request('/api/v1/cases', {
      body: JSON.stringify({ title: 'Concurrent lifecycle test' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    const created = (await createResponse.json()) as Case

    const startTransitionId = crypto.randomUUID()
    const start = () =>
      app.request(`/api/v1/cases/${created.id}/transition`, {
        body: JSON.stringify({
          expectedVersion: created.version,
          fromStatus: 'new',
          toStatus: 'working',
          transitionId: startTransitionId,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    const startResponses = await withConcurrentFlushes(() => Promise.all([start(), start()]))
    const startResults = await Promise.all(
      startResponses.map((response) => response.json() as Promise<CaseStatusChange>),
    )

    expect(startResponses.map((response) => response.status)).toEqual([200, 200])
    expect(startResults[0]).toMatchObject({
      caseVersion: created.version + 1,
      toStatus: 'working',
    })
    expect(startResults[1]).toEqual(startResults[0])

    const closeTransitionId = crypto.randomUUID()
    const close = () =>
      app.request(`/api/v1/cases/${created.id}/transition`, {
        body: JSON.stringify({
          expectedVersion: startResults[0].caseVersion,
          fromStatus: 'working',
          toStatus: 'resolved',
          transitionId: closeTransitionId,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    const closeResponses = await withConcurrentFlushes(() => Promise.all([close(), close()]))
    const closeResults = await Promise.all(
      closeResponses.map((response) => response.json() as Promise<CaseStatusChange>),
    )

    expect(closeResponses.map((response) => response.status)).toEqual([200, 200])
    expect(closeResults[0]).toMatchObject({
      caseVersion: startResults[0].caseVersion + 1,
      toStatus: 'resolved',
    })
    expect(closeResults[1]).toEqual(closeResults[0])

    const eventCounts = await orm.em
      .getConnection()
      .execute<Array<{ count: number; type: string }>>(
        'select type, count(*)::int as count from platform_outbox_events group by type order by type',
      )
    expect(eventCounts).toEqual([
      { count: 1, type: 'case.created' },
      { count: 2, type: 'case.transitioned' },
    ])
  })

  it('postpones only new cases, restores them, and keeps them outside the open group', async () => {
    const app = createTestApp('ddbdc2cc-bbc9-4426-97bf-d99520983bbb')
    const createResponse = await app.request('/api/v1/cases', {
      body: JSON.stringify({ title: 'Postpone lifecycle test' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    const created = (await createResponse.json()) as Case
    const postponeTransitionId = crypto.randomUUID()
    const postpone = () =>
      app.request(`/api/v1/cases/${created.id}/transition`, {
        body: JSON.stringify({
          expectedVersion: created.version,
          fromStatus: 'new',
          toStatus: 'postponed',
          transitionId: postponeTransitionId,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })

    const postponedResponse = await postpone()
    const postponed = (await postponedResponse.json()) as CaseStatusChange
    const replayResponse = await postpone()
    expect(postponedResponse.status).toBe(200)
    expect(replayResponse.status).toBe(200)
    await expect(replayResponse.json()).resolves.toEqual(postponed)
    expect(postponed).toMatchObject({ note: null, toStatus: 'postponed' })

    const currentResponse = await app.request(`/api/v1/cases/${created.id}`)
    await expect(currentResponse.json()).resolves.toMatchObject({
      closedAt: null,
      status: 'postponed',
      statusNote: null,
    })
    const openResponse = await app.request('/api/v1/cases?statusGroup=open')
    const postponedListResponse = await app.request('/api/v1/cases?status=postponed')
    const open = (await openResponse.json()) as { items: Case[] }
    const postponedList = (await postponedListResponse.json()) as { items: Case[] }
    expect(open.items.map((item) => item.id)).not.toContain(created.id)
    expect(postponedList.items.map((item) => item.id)).toEqual([created.id])

    const restoreResponse = await app.request(`/api/v1/cases/${created.id}/transition`, {
      body: JSON.stringify({
        expectedVersion: postponed.caseVersion,
        fromStatus: 'postponed',
        toStatus: 'new',
        transitionId: crypto.randomUUID(),
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    const restored = (await restoreResponse.json()) as CaseStatusChange
    expect(restored).toMatchObject({ fromStatus: 'postponed', note: null, toStatus: 'new' })

    const postponeAgainResponse = await app.request(`/api/v1/cases/${created.id}/transition`, {
      body: JSON.stringify({
        expectedVersion: restored.caseVersion,
        fromStatus: 'new',
        toStatus: 'postponed',
        transitionId: crypto.randomUUID(),
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    const postponedAgain = (await postponeAgainResponse.json()) as CaseStatusChange
    const resolveResponse = await app.request(`/api/v1/cases/${created.id}/transition`, {
      body: JSON.stringify({
        expectedVersion: postponedAgain.caseVersion,
        fromStatus: 'postponed',
        toStatus: 'resolved',
        transitionId: crypto.randomUUID(),
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(resolveResponse.status).toBe(200)
    const resolvedCaseResponse = await app.request(`/api/v1/cases/${created.id}`)
    const resolvedCase = (await resolvedCaseResponse.json()) as Case
    expect(resolvedCase).toMatchObject({ status: 'resolved', statusNote: null })
    expect(resolvedCase.closedAt).toEqual(expect.any(String))

    const eventVersions = await orm.em.getConnection().execute<Array<{ schema_version: number }>>(
      `select schema_version from platform_outbox_events
         where type = 'case.transitioned' order by aggregate_version`,
    )
    expect(eventVersions.map((event) => event.schema_version)).toEqual([2, 2, 2, 2])
  })

  it('paginates case lists and applies status and customer filters', async () => {
    const app = createTestApp('ddbdc2cc-bbc9-4426-97bf-d99520983bbb')
    const customerId = '5a4d55ee-f3c6-45c3-8309-e7c684f0a2be'
    const createCase = async (title: string, selectedCustomerId?: string) => {
      const response = await app.request('/api/v1/cases', {
        body: JSON.stringify({
          ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
          title,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      return (await response.json()) as Case
    }
    const first = await createCase('First')
    await createCase('Second', customerId)
    await createCase('Third')

    const firstPageResponse = await app.request('/api/v1/cases?limit=2')
    const firstPage = (await firstPageResponse.json()) as {
      items: Case[]
      nextCursor: string | null
    }
    expect(firstPage.items).toHaveLength(2)
    expect(firstPage.nextCursor).toEqual(expect.any(String))

    const nextPageResponse = await app.request(
      `/api/v1/cases?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor as string)}`,
    )
    const nextPage = (await nextPageResponse.json()) as { items: Case[]; nextCursor: string | null }
    expect(nextPage.items).toHaveLength(1)
    const allIds = [...firstPage.items, ...nextPage.items].map((item) => item.id)
    expect(allIds).toHaveLength(3)
    expect(new Set(allIds).size).toBe(3)
    expect(allIds).toContain(first.id)
    expect(nextPage.nextCursor).toBeNull()

    await app.request(`/api/v1/cases/${first.id}/transition`, {
      body: JSON.stringify({
        expectedVersion: first.version,
        fromStatus: 'new',
        toStatus: 'resolved',
        transitionId: crypto.randomUUID(),
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    const closedResponse = await app.request('/api/v1/cases?statusGroup=closed')
    const openResponse = await app.request('/api/v1/cases?statusGroup=open')
    const resolvedResponse = await app.request('/api/v1/cases?status=resolved')
    const customerResponse = await app.request(`/api/v1/cases?customerId=${customerId}`)
    const closed = (await closedResponse.json()) as { items: Case[] }
    const open = (await openResponse.json()) as { items: Case[] }
    const resolved = (await resolvedResponse.json()) as { items: Case[] }
    const customerCases = (await customerResponse.json()) as { items: Case[] }

    expect(closed.items.map((item) => item.id)).toEqual([first.id])
    expect(open.items).toHaveLength(2)
    expect(resolved.items.map((item) => item.id)).toEqual([first.id])
    expect(customerCases.items.map((item) => item.customerId)).toEqual([customerId])
  })

  it('searches case title, description, and id inside organization and status filters', async () => {
    const organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb'
    const app = createTestApp(organizationId)
    const createCase = async (title: string, description?: string) => {
      const response = await app.request('/api/v1/cases', {
        body: JSON.stringify({ ...(description ? { description } : {}), title }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      return (await response.json()) as Case
    }
    const invoice = await createCase('Quarterly Invoice', 'Customer cannot open the attachment')
    const otherQuarterly = await createCase('Another quarterly issue')
    const renewal = await createCase('General request', 'Annual RENEWAL details')
    const literalWildcard = await createCase('Literal 100% case')

    const otherOrganization = createTestApp('98b5d140-f720-4e64-89c3-59adc699cfe0')
    await otherOrganization.request('/api/v1/cases', {
      body: JSON.stringify({ title: 'Quarterly foreign case' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    const search = async (value: string, suffix = '') => {
      const response = await app.request(
        `/api/v1/cases?search=${encodeURIComponent(value)}${suffix}`,
      )
      return {
        body: (await response.json()) as { items: Case[]; nextCursor: string | null },
        response,
      }
    }

    const titleResult = await search('QUARTERLY', '&limit=1')
    expect(titleResult.response.status).toBe(200)
    expect(titleResult.body.items).toHaveLength(1)
    expect(titleResult.body.nextCursor).toEqual(expect.any(String))
    const nextTitlePage = await search(
      'quarterly',
      `&limit=1&cursor=${encodeURIComponent(titleResult.body.nextCursor as string)}`,
    )
    expect(nextTitlePage.body.items).toHaveLength(1)
    expect(nextTitlePage.body.nextCursor).toBeNull()
    expect(
      new Set([...titleResult.body.items, ...nextTitlePage.body.items].map((item) => item.id)),
    ).toEqual(new Set([invoice.id, otherQuarterly.id]))

    const descriptionResult = await search('renewal')
    expect(descriptionResult.body.items.map((item) => item.id)).toEqual([renewal.id])

    const idResult = await search(invoice.id.slice(0, 8).toUpperCase())
    expect(idResult.body.items.map((item) => item.id)).toEqual([invoice.id])

    const wildcardResult = await search('%')
    expect(wildcardResult.body.items.map((item) => item.id)).toEqual([literalWildcard.id])

    await app.request(`/api/v1/cases/${invoice.id}/transition`, {
      body: JSON.stringify({
        expectedVersion: invoice.version,
        fromStatus: 'new',
        toStatus: 'working',
        transitionId: crypto.randomUUID(),
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    const workingResult = await search('quarterly', '&status=working')
    const newResult = await search('quarterly', '&status=new')
    expect(workingResult.body.items.map((item) => item.id)).toEqual([invoice.id])
    expect(newResult.body.items).toHaveLength(1)
    expect(newResult.body.items[0]?.id).not.toBe(invoice.id)

    expect((await app.request('/api/v1/cases?search=')).status).toBe(400)
    expect((await app.request('/api/v1/cases?search=%20%20%20')).status).toBe(400)
    expect(
      (await app.request(`/api/v1/cases?search=${encodeURIComponent('x'.repeat(201))}`)).status,
    ).toBe(400)
  })

  function createTestApp(organizationId: string, actorResolver?: ActorResolver) {
    const config: AppConfig = {
      appVersion: 'test',
      databaseUrl: databaseUrl as string,
      logLevel: 'error',
      nodeEnv: 'test',
      organizationId,
      port: 3000,
      staticRoot: '/tmp/yetano-work-missing-static',
    }
    const container = createRootContainer({
      ...(actorResolver ? { actorResolver } : {}),
      config,
      logger,
      orm,
    })
    return createApp({ container })
  }
})

const logger: Logger = {
  child: () => logger,
  debug: () => undefined,
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
}

async function withConcurrentFlushes<Result>(run: () => Promise<Result>): Promise<Result> {
  const originalFlush = EntityManager.prototype.flush
  let interceptedFlushes = 0
  let releaseBarrier = () => undefined
  const barrier = new Promise<void>((resolve) => {
    releaseBarrier = resolve
  })
  const timeout = setTimeout(releaseBarrier, 5_000)
  const flush = vi.spyOn(EntityManager.prototype, 'flush').mockImplementation(async function () {
    if (interceptedFlushes < 2) {
      interceptedFlushes += 1
      if (interceptedFlushes === 2) releaseBarrier()
      await barrier
    }
    return originalFlush.call(this)
  })

  try {
    const result = await run()
    expect(interceptedFlushes).toBe(2)
    return result
  } finally {
    clearTimeout(timeout)
    flush.mockRestore()
  }
}
