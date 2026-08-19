import { EntityManager } from '@mikro-orm/core'
import { MikroORM } from '@mikro-orm/postgresql'
import type { Case } from '@yetano/contracts'
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
      .execute('truncate table cases, platform_outbox_events restart identity')
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
    const secondOrganizationList = await secondApp.request('/api/v1/cases')

    expect(crossOrganizationRead.status).toBe(404)
    await expect(secondOrganizationList.json()).resolves.toEqual({ items: [], nextCursor: null })
  })

  it('rejects forged scope and stale mutations, and makes lifecycle transitions idempotent', async () => {
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

    const close = () =>
      app.request(`/api/v1/cases/${created.id}/close`, {
        body: JSON.stringify({ expectedVersion: updated.version }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    const firstClose = await close()
    const closed = (await firstClose.json()) as Case
    const repeatedClose = await close()
    const closedAgain = (await repeatedClose.json()) as Case

    expect(firstClose.status).toBe(200)
    expect(repeatedClose.status).toBe(200)
    expect(closedAgain).toEqual(closed)

    const eventCounts = await orm.em
      .getConnection()
      .execute<Array<{ count: number; type: string }>>(
        'select type, count(*)::int as count from platform_outbox_events group by type order by type',
      )
    expect(eventCounts).toEqual([
      { count: 1, type: 'case.closed' },
      { count: 1, type: 'case.created' },
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

    const close = () =>
      app.request(`/api/v1/cases/${created.id}/close`, {
        body: JSON.stringify({ expectedVersion: created.version }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    const closeResponses = await withConcurrentFlushes(() => Promise.all([close(), close()]))
    const closedCases = await Promise.all(
      closeResponses.map((response) => response.json() as Promise<Case>),
    )

    expect(closeResponses.map((response) => response.status)).toEqual([200, 200])
    expect(closedCases[0]).toMatchObject({ status: 'closed', version: created.version + 1 })
    expect(closedCases[1]).toEqual(closedCases[0])

    const reopen = () =>
      app.request(`/api/v1/cases/${created.id}/reopen`, {
        body: JSON.stringify({ expectedVersion: closedCases[0].version }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    const reopenResponses = await withConcurrentFlushes(() => Promise.all([reopen(), reopen()]))
    const reopenedCases = await Promise.all(
      reopenResponses.map((response) => response.json() as Promise<Case>),
    )

    expect(reopenResponses.map((response) => response.status)).toEqual([200, 200])
    expect(reopenedCases[0]).toMatchObject({ status: 'open', version: closedCases[0].version + 1 })
    expect(reopenedCases[1]).toEqual(reopenedCases[0])

    const eventCounts = await orm.em
      .getConnection()
      .execute<Array<{ count: number; type: string }>>(
        'select type, count(*)::int as count from platform_outbox_events group by type order by type',
      )
    expect(eventCounts).toEqual([
      { count: 1, type: 'case.closed' },
      { count: 1, type: 'case.created' },
      { count: 1, type: 'case.reopened' },
    ])
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

    await app.request(`/api/v1/cases/${first.id}/close`, {
      body: JSON.stringify({ expectedVersion: first.version }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    const closedResponse = await app.request('/api/v1/cases?status=closed')
    const customerResponse = await app.request(`/api/v1/cases?customerId=${customerId}`)
    const closed = (await closedResponse.json()) as { items: Case[] }
    const customerCases = (await customerResponse.json()) as { items: Case[] }

    expect(closed.items.map((item) => item.id)).toEqual([first.id])
    expect(customerCases.items.map((item) => item.customerId)).toEqual([customerId])
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
