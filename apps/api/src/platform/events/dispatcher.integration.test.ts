import { randomUUID } from 'node:crypto'

import { MikroORM } from '@mikro-orm/postgresql'
import { createContainer } from 'awilix'
import { Hono } from 'hono'
import Type from 'typebox'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppContainer, Cradle } from '../../container.js'
import { createOrmOptions } from '../../database.js'
import type { AppEnvironment } from '../../http-types.js'
import type { Logger } from '../../logger.js'
import { createModuleCatalog } from '../../modules/catalog.js'
import {
  defineEvent,
  defineModule,
  defineSubscription,
  type EventSubscriptionContext,
  type PublishedEvent,
} from '../../modules/module.js'
import { createOutboxDispatcher } from './dispatcher.js'
import { OutboxEventEntity } from './outbox.entity.js'

const databaseUrl = process.env.TEST_DATABASE_URL
const describeWithDatabase = databaseUrl ? describe : describe.skip
const TestPayloadSchema = Type.Object({ value: Type.String() }, { additionalProperties: false })
const testEvent = defineEvent({
  description: 'Event used to verify outbox delivery.',
  id: 'test.deliver',
  schemaVersion: 1,
  versions: [{ payloadSchema: TestPayloadSchema, schemaVersion: 1 }],
})

type TestEvent = PublishedEvent<typeof testEvent, readonly [1]>
type TestHandler = (event: TestEvent, context: EventSubscriptionContext) => Promise<void>

describeWithDatabase('outbox dispatcher with PostgreSQL', () => {
  let orm: MikroORM
  let rootContainer: AppContainer

  beforeAll(async () => {
    orm = await MikroORM.init(createOrmOptions({ databaseUrl: databaseUrl as string }))
    await orm.migrator.up()
    rootContainer = createContainer<Cradle>({ strict: true })
  })

  beforeEach(async () => {
    await orm.em
      .getConnection()
      .execute('truncate table platform_event_inbox, platform_outbox_events')
  })

  afterAll(async () => {
    await rootContainer?.dispose()
    await orm?.close(true)
  })

  it('validates and delivers a typed event with a scoped execution context', async () => {
    const delivered: Array<{ context: EventSubscriptionContext; event: TestEvent }> = []
    const seeded = await seedEvent(orm)
    const dispatcher = dispatcherWithHandlers([
      async (event, context) => {
        delivered.push({ context, event })
      },
    ])

    await dispatcher.dispatchOnce()

    expect(delivered).toHaveLength(1)
    expect(delivered[0]?.event).toEqual({
      aggregateId: 'case-id',
      aggregateVersion: 3,
      payload: { value: 'payload' },
      schemaVersion: 1,
      type: testEvent.id,
    })
    expect(delivered[0]?.context).toMatchObject({
      actor: { id: 'test-user', type: 'user' },
      correlationId: 'correlation-id',
      eventId: seeded.id,
      occurredAt: seeded.occurredAt,
      organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
    })
    expect(delivered[0]?.context.entityManager).toBeDefined()
    expect(delivered[0]?.context.logger).toBe(logger)
    await expect(outboxRows(orm)).resolves.toEqual([])
    await expect(inboxRows(orm)).resolves.toEqual([
      {
        event_id: seeded.id,
        subscription_id: 'consumer-0:test.deliver',
      },
    ])
  })

  it('rejects an invalid payload before invoking the subscriber', async () => {
    const handle = vi.fn<TestHandler>()
    const event = await seedEvent(orm, { payload: { unexpected: true } })
    const dispatcher = dispatcherWithHandlers([handle])

    await dispatcher.dispatchOnce()

    expect(handle).not.toHaveBeenCalled()
    await expect(inboxRows(orm)).resolves.toEqual([])
    await expect(outboxRows(orm)).resolves.toEqual([
      expect.objectContaining({
        attempts: 1,
        id: event.id,
        last_error: expect.stringContaining('Invalid test.deliver v1 payload'),
      }),
    ])
  })

  it('rejects a schema version not declared by the subscriber', async () => {
    const handle = vi.fn<TestHandler>()
    const event = await seedEvent(orm, { schemaVersion: 2 })
    const dispatcher = dispatcherWithHandlers([handle])

    await dispatcher.dispatchOnce()

    expect(handle).not.toHaveBeenCalled()
    await expect(outboxRows(orm)).resolves.toEqual([
      expect.objectContaining({
        attempts: 1,
        id: event.id,
        last_error: expect.stringContaining(
          'Subscription consumer-0:test.deliver does not support test.deliver schema version 2',
        ),
      }),
    ])
  })

  it('does not repeat a completed subscriber when a later subscriber is retried', async () => {
    const first = vi.fn<TestHandler>(async () => {})
    const second = vi
      .fn<TestHandler>()
      .mockRejectedValueOnce(new Error('later subscriber failed'))
      .mockResolvedValueOnce()
    const event = await seedEvent(orm)
    const dispatcher = dispatcherWithHandlers([first, second])

    await dispatcher.dispatchOnce()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    await expect(inboxRows(orm)).resolves.toEqual([
      { event_id: event.id, subscription_id: 'consumer-0:test.deliver' },
    ])

    await makeReady(orm, event.id)
    await dispatcher.dispatchOnce()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
    await expect(outboxRows(orm)).resolves.toEqual([])
    await expect(inboxRows(orm)).resolves.toEqual([
      { event_id: event.id, subscription_id: 'consumer-0:test.deliver' },
      { event_id: event.id, subscription_id: 'consumer-1:test.deliver' },
    ])
  })

  it('continues to later subscribers when an earlier subscriber is retried', async () => {
    const first = vi
      .fn<TestHandler>()
      .mockRejectedValueOnce(new Error('first subscriber failed'))
      .mockResolvedValueOnce()
    const second = vi.fn<TestHandler>(async () => {})
    const event = await seedEvent(orm)
    const dispatcher = dispatcherWithHandlers([first, second])

    await dispatcher.dispatchOnce()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    await expect(outboxRows(orm)).resolves.toEqual([
      expect.objectContaining({
        attempts: 1,
        id: event.id,
        last_error: expect.stringContaining(
          'Subscription consumer-0:test.deliver failed: first subscriber failed',
        ),
      }),
    ])
    await expect(inboxRows(orm)).resolves.toEqual([
      { event_id: event.id, subscription_id: 'consumer-1:test.deliver' },
    ])

    await makeReady(orm, event.id)
    await dispatcher.dispatchOnce()

    expect(first).toHaveBeenCalledTimes(2)
    expect(second).toHaveBeenCalledTimes(1)
    await expect(outboxRows(orm)).resolves.toEqual([])
    await expect(inboxRows(orm)).resolves.toEqual([
      { event_id: event.id, subscription_id: 'consumer-0:test.deliver' },
      { event_id: event.id, subscription_id: 'consumer-1:test.deliver' },
    ])
  })

  it('delivers one aggregate strictly by aggregate version', async () => {
    const deliveredVersions: number[] = []
    const later = await seedEvent(orm, {
      aggregateVersion: 2,
      occurredAt: new Date('2026-08-23T10:00:00.000Z'),
    })
    const earlier = await seedEvent(orm, {
      aggregateVersion: 1,
      occurredAt: new Date('2026-08-23T11:00:00.000Z'),
    })
    const dispatcher = dispatcherWithHandlers([
      async (event) => {
        deliveredVersions.push(event.aggregateVersion)
      },
    ])

    await dispatcher.dispatchOnce()

    expect(deliveredVersions).toEqual([1])
    await expect(outboxRows(orm)).resolves.toEqual([expect.objectContaining({ id: later.id })])
    await expect(inboxRows(orm)).resolves.toEqual([
      { event_id: earlier.id, subscription_id: 'consumer-0:test.deliver' },
    ])

    await dispatcher.dispatchOnce()

    expect(deliveredVersions).toEqual([1, 2])
    await expect(outboxRows(orm)).resolves.toEqual([])
  })

  it('marks the event as failed after the tenth delivery attempt', async () => {
    const event = await seedEvent(orm, { attempts: 9 })
    const dispatcher = dispatcherWithHandlers([
      async () => {
        throw new Error('terminal failure')
      },
    ])

    await dispatcher.dispatchOnce()

    await expect(outboxRows(orm)).resolves.toEqual([
      expect.objectContaining({
        attempts: 10,
        failed: true,
        id: event.id,
        last_error: expect.stringContaining('terminal failure'),
        locked_by: null,
        locked_until: null,
      }),
    ])
  })

  function dispatcherWithHandlers(handlers: readonly TestHandler[]) {
    return createOutboxDispatcher({
      logger,
      moduleCatalog: catalogWithHandlers(handlers),
      orm,
      rootContainer,
    })
  }
})

function catalogWithHandlers(handlers: readonly TestHandler[]) {
  return createModuleCatalog([
    testModule('publisher', '/publisher', {
      publishes: [testEvent],
      subscribes: [],
    }),
    ...handlers.map((handle, index) =>
      testModule(`consumer-${index}`, `/consumer-${index}`, {
        publishes: [],
        subscribes: [defineSubscription({ event: testEvent, handle, supportedVersions: [1] })],
      }),
    ),
  ])
}

function testModule(
  id: string,
  path: `/${string}`,
  events: Parameters<typeof defineModule>[0]['events'],
) {
  return defineModule({
    capabilities: [],
    dependencies: id.startsWith('consumer-') ? ['publisher'] : [],
    entities: [],
    events,
    extensions: { contributes: [], provides: [] },
    http: { access: 'public', path },
    id,
    operations: [],
    registrations: {},
    routes: () => new Hono<AppEnvironment>(),
  })
}

async function seedEvent(
  orm: MikroORM,
  overrides: {
    aggregateVersion?: number
    attempts?: number
    occurredAt?: Date
    payload?: Record<string, unknown>
    schemaVersion?: number
  } = {},
) {
  const entityManager = orm.em.fork()
  const occurredAt = overrides.occurredAt ?? new Date()
  const id = randomUUID()
  entityManager.persist(
    entityManager.create(OutboxEventEntity, {
      actorId: 'test-user',
      actorType: 'user',
      aggregateId: 'case-id',
      aggregateVersion: overrides.aggregateVersion ?? 3,
      attempts: overrides.attempts ?? 0,
      correlationId: 'correlation-id',
      failedAt: null,
      id,
      lastError: null,
      lockedBy: null,
      lockedUntil: null,
      nextAttemptAt: occurredAt,
      occurredAt,
      organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
      payload: overrides.payload ?? { value: 'payload' },
      schemaVersion: overrides.schemaVersion ?? 1,
      type: testEvent.id,
    }),
  )
  await entityManager.flush()
  return { id, occurredAt }
}

async function makeReady(orm: MikroORM, eventId: string) {
  await orm.em
    .getConnection()
    .execute('update platform_outbox_events set next_attempt_at = now() where id = ?', [eventId])
}

async function inboxRows(orm: MikroORM) {
  return orm.em.getConnection().execute<
    Array<{
      event_id: string
      subscription_id: string
    }>
  >(
    `select event_id, subscription_id
     from platform_event_inbox
     order by subscription_id, event_id`,
  )
}

async function outboxRows(orm: MikroORM) {
  return orm.em.getConnection().execute<
    Array<{
      attempts: number
      failed: boolean
      id: string
      last_error: string | null
      locked_by: string | null
      locked_until: Date | null
      retry_scheduled: boolean
    }>
  >(
    `select id, attempts, failed_at is not null as failed, last_error, locked_by, locked_until,
            next_attempt_at > now() as retry_scheduled
     from platform_outbox_events
     order by occurred_at, id`,
  )
}

const logger: Logger = {
  child: () => logger,
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}
