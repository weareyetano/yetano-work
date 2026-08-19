import { randomUUID } from 'node:crypto'

import { MikroORM } from '@mikro-orm/postgresql'
import { Hono } from 'hono'
import Type from 'typebox'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createOrmOptions } from '../../database.js'
import type { AppEnvironment } from '../../http-types.js'
import type { Logger } from '../../logger.js'
import { createModuleCatalog } from '../../modules/catalog.js'
import { defineEvent, defineModule, type PublishedEventEnvelope } from '../../modules/module.js'
import { createOutboxDispatcher } from './dispatcher.js'
import { OutboxEventEntity } from './outbox.entity.js'

const databaseUrl = process.env.TEST_DATABASE_URL
const describeWithDatabase = databaseUrl ? describe : describe.skip
const testEvent = defineEvent({
  description: 'Event used to verify outbox delivery.',
  id: 'test.deliver',
  payloadSchema: Type.Object({ value: Type.String() }, { additionalProperties: false }),
  schemaVersion: 1,
})

describeWithDatabase('outbox dispatcher with PostgreSQL', () => {
  let orm: Awaited<ReturnType<typeof MikroORM.init>>

  beforeAll(async () => {
    orm = await MikroORM.init(createOrmOptions({ databaseUrl: databaseUrl as string }))
    await orm.migrator.up()
  })

  beforeEach(async () => {
    await orm.em.getConnection().execute('truncate table platform_outbox_events')
  })

  afterAll(async () => {
    await orm?.close(true)
  })

  it('delivers a complete envelope and removes the claimed row', async () => {
    const delivered: PublishedEventEnvelope[] = []
    const eventId = await seedEvent(orm)
    const dispatcher = createOutboxDispatcher({
      logger,
      moduleCatalog: catalogWithHandler(async (event) => {
        delivered.push(event)
      }),
      orm,
    })

    await dispatcher.dispatchOnce()

    expect(delivered).toEqual([
      {
        actorId: 'test-user',
        actorType: 'user',
        aggregateId: 'case-id',
        aggregateVersion: 3,
        correlationId: 'correlation-id',
        eventId,
        organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
        payload: { value: 'payload' },
        schemaVersion: 1,
        type: testEvent.id,
      },
    ])
    await expect(outboxRows(orm)).resolves.toEqual([])
  })

  it('records a retry and releases the lease after subscriber failure', async () => {
    const eventId = await seedEvent(orm)
    const dispatcher = createOutboxDispatcher({
      logger,
      moduleCatalog: catalogWithHandler(async () => {
        throw new Error('subscriber failed')
      }),
      orm,
    })

    await dispatcher.dispatchOnce()

    await expect(outboxRows(orm)).resolves.toEqual([
      expect.objectContaining({
        attempts: 1,
        failed_at: null,
        id: eventId,
        last_error: 'subscriber failed',
        locked_by: null,
        locked_until: null,
        retry_scheduled: true,
      }),
    ])
  })

  it('marks the event as failed after the tenth delivery attempt', async () => {
    const eventId = await seedEvent(orm, 9)
    const dispatcher = createOutboxDispatcher({
      logger,
      moduleCatalog: catalogWithHandler(async () => {
        throw new Error('terminal failure')
      }),
      orm,
    })

    await dispatcher.dispatchOnce()

    await expect(outboxRows(orm)).resolves.toEqual([
      expect.objectContaining({
        attempts: 10,
        failed_at: expect.any(Date),
        id: eventId,
        last_error: 'terminal failure',
        locked_by: null,
        locked_until: null,
      }),
    ])
  })
})

function catalogWithHandler(handle: (event: PublishedEventEnvelope) => Promise<void>) {
  return createModuleCatalog([
    defineModule({
      capabilities: [],
      dependencies: [],
      entities: [],
      events: {
        publishes: [testEvent],
        subscribes: [{ eventId: testEvent.id, handle, id: 'test.deliver-handler' }],
      },
      extensions: { contributes: [], provides: [] },
      id: 'test-events',
      operations: [],
      registrations: {},
      routes: () => new Hono<AppEnvironment>(),
    }),
  ])
}

async function seedEvent(orm: Awaited<ReturnType<typeof MikroORM.init>>, attempts = 0) {
  const entityManager = orm.em.fork()
  const occurredAt = new Date()
  const id = randomUUID()
  entityManager.persist(
    entityManager.create(OutboxEventEntity, {
      actorId: 'test-user',
      actorType: 'user',
      aggregateId: 'case-id',
      aggregateVersion: 3,
      attempts,
      correlationId: 'correlation-id',
      failedAt: null,
      id,
      lastError: null,
      lockedBy: null,
      lockedUntil: null,
      nextAttemptAt: occurredAt,
      occurredAt,
      organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
      payload: { value: 'payload' },
      schemaVersion: 1,
      type: testEvent.id,
    }),
  )
  await entityManager.flush()
  return id
}

async function outboxRows(orm: Awaited<ReturnType<typeof MikroORM.init>>) {
  return orm.em.getConnection().execute<
    Array<{
      attempts: number
      failed_at: Date | null
      id: string
      last_error: string | null
      locked_by: string | null
      locked_until: Date | null
      retry_scheduled: boolean
    }>
  >(
    `select id, attempts, failed_at, last_error, locked_by, locked_until,
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
