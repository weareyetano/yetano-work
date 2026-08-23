import type { MikroORM } from '@mikro-orm/postgresql'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { createApp } from './app.js'
import type { AppConfig } from './config.js'
import { createRootContainer } from './container.js'
import type { AppEnvironment } from './http-types.js'
import type { Logger } from './logger.js'
import { createModuleCatalog } from './modules/catalog.js'
import { defineModule } from './modules/module.js'
import type { ActorResolver } from './platform/execution/context.js'
import { AuthorizationDeniedError } from './platform/execution/errors.js'

describe('API application without runtime services', () => {
  const app = createApp()

  it('exports OpenAPI without starting PostgreSQL', async () => {
    const response = await app.request('/api/openapi.json')
    const document = await response.json()

    expect(response.status).toBe(200)
    expect(document.openapi).toBe('3.1.0')
    expect(document.paths).toHaveProperty('/api/v1/health')
  })

  it('exports the shared six-value case status filter constraint', async () => {
    const response = await app.request('/api/openapi.json')
    const document = await response.json()
    const parameters = document.paths['/api/v1/cases'].get.parameters as Array<{
      name: string
      schema: Record<string, unknown>
    }>
    const statusParameter = parameters.find((parameter) => parameter.name === 'status')

    expect(statusParameter?.schema).toMatchObject({
      maxItems: 6,
      minItems: 1,
      title: 'CaseStatusFilter',
      uniqueItems: true,
    })
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

describe('module HTTP access composition', () => {
  it('keeps public modules public and protects an arbitrary module path', async () => {
    const resolveActor = vi.fn<ActorResolver['resolve']>().mockResolvedValue(null)
    const app = createTestApp({ resolve: resolveActor })

    const publicResponse = await app.request('/api/v1/public-test')
    const protectedResponse = await app.request('/api/v1/tasks-test')

    expect(publicResponse.status).toBe(200)
    expect(resolveActor).toHaveBeenCalledTimes(1)
    expect(protectedResponse.status).toBe(401)
    await expect(protectedResponse.json()).resolves.toMatchObject({
      status: 401,
      title: 'Unauthorized',
    })
  })

  it('provides execution context and maps authorization failures for protected modules', async () => {
    const app = createTestApp()

    const protectedResponse = await app.request('/api/v1/tasks-test')
    const forbiddenResponse = await app.request('/api/v1/tasks-test/forbidden')

    expect(protectedResponse.status).toBe(200)
    await expect(protectedResponse.json()).resolves.toEqual({ actorId: 'local-dev' })
    expect(forbiddenResponse.status).toBe(403)
    await expect(forbiddenResponse.json()).resolves.toMatchObject({
      status: 403,
      title: 'Forbidden',
    })
  })
})

describe('runtime event wiring', () => {
  it('resolves the singleton dispatcher with access to delivery scopes', () => {
    const container = createTestContainer()

    expect(container.resolve('outboxDispatcher')).toMatchObject({
      dispatchOnce: expect.any(Function),
      start: expect.any(Function),
      stop: expect.any(Function),
    })
  })
})

const testModules = [
  defineModule({
    capabilities: [],
    dependencies: [],
    entities: [],
    events: { publishes: [], subscribes: [] },
    extensions: { contributes: [], provides: [] },
    http: { access: 'public', path: '/public-test' },
    id: 'public-test',
    operations: [],
    registrations: {},
    routes: () =>
      new Hono<AppEnvironment>().get('', (context) =>
        context.json({ access: 'public' as const }, 200),
      ),
  }),
  defineModule({
    capabilities: [],
    dependencies: [],
    entities: [],
    events: { publishes: [], subscribes: [] },
    extensions: { contributes: [], provides: [] },
    http: { access: 'protected', path: '/tasks-test' },
    id: 'tasks-test',
    operations: [],
    registrations: {},
    routes: () =>
      new Hono<AppEnvironment>()
        .get('', (context) =>
          context.json({ actorId: context.get('executionContext').actor.id }, 200),
        )
        .get('/forbidden', () => {
          throw new AuthorizationDeniedError('tasks.read')
        }),
  }),
] as const
const testModuleCatalog = createModuleCatalog(testModules)

function createTestApp(actorResolver?: ActorResolver) {
  return createApp({
    container: createTestContainer(actorResolver),
    moduleCatalog: testModuleCatalog,
  })
}

function createTestContainer(actorResolver?: ActorResolver) {
  const config: AppConfig = {
    appVersion: 'test',
    databaseUrl: 'postgresql://unused',
    logLevel: 'error',
    nodeEnv: 'test',
    organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
    port: 3000,
    staticRoot: '/tmp/yetano-work-missing-static',
  }
  const entityManager = { fork: () => entityManager }
  const orm = { em: { fork: () => entityManager } } as unknown as MikroORM
  const container = createRootContainer({
    ...(actorResolver ? { actorResolver } : {}),
    config,
    logger,
    orm,
  })
  return container
}

const logger: Logger = {
  child: () => logger,
  debug: () => undefined,
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
}
