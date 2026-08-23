import { randomUUID } from 'node:crypto'

import type { EntityManager, MikroORM } from '@mikro-orm/postgresql'
import type { OrganizationId } from '@yetano/contracts'
import { asValue } from 'awilix'
import { Compile } from 'typebox/compile'

import type { AppContainer } from '../../container.js'
import type { Logger } from '../../logger.js'
import type { ModuleCatalog } from '../../modules/catalog.js'
import {
  type EventDefinition,
  type EventSubscription,
  eventSubscriptionId,
  type PublishedEvent,
} from '../../modules/module.js'

interface ClaimedEventRow {
  actor_id: string
  actor_type: 'system' | 'user'
  aggregate_id: string
  aggregate_version: number
  correlation_id: string
  id: string
  occurred_at: Date | string
  organization_id: string
  payload: Record<string, unknown>
  schema_version: number
  type: string
}

interface RegisteredSubscription {
  definition: EventDefinition
  id: string
  subscription: EventSubscription
  validators: ReadonlyMap<number, ReturnType<typeof Compile>>
}

export interface OutboxDispatcher {
  dispatchOnce(): Promise<void>
  start(): void
  stop(): Promise<void>
}

export function createOutboxDispatcher({
  logger,
  moduleCatalog,
  orm,
  rootContainer,
}: {
  logger: Logger
  moduleCatalog: ModuleCatalog
  orm: MikroORM
  rootContainer: AppContainer
}): OutboxDispatcher {
  const dispatcherId = randomUUID()
  const subscriptions = collectSubscriptions(moduleCatalog)

  let interval: ReturnType<typeof setInterval> | undefined
  let running: Promise<void> | undefined
  let stopped = false

  const tick = async () => {
    if (running || stopped) return
    running = dispatchBatch()
      .catch((error: unknown) => {
        logger.error('Outbox dispatch batch failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => {
        running = undefined
      })
    await running
  }

  const dispatchBatch = async () => {
    const entityManager = orm.em.fork()
    const rows = await claimReadyEvents(entityManager, dispatcherId)

    for (const row of rows) {
      try {
        const failures: Error[] = []
        for (const subscription of subscriptions.get(row.type) ?? []) {
          try {
            await deliverToSubscription(row, subscription, { logger, orm, rootContainer })
          } catch (error) {
            const cause = error instanceof Error ? error : new Error(String(error))
            failures.push(
              new Error(`Subscription ${subscription.id} failed: ${cause.message}`, { cause }),
            )
          }
        }
        if (failures.length > 0) {
          throw new AggregateError(
            failures,
            `Event ${row.id} was not fully delivered: ${failures.map(({ message }) => message).join('; ')}`,
          )
        }
        await entityManager
          .getConnection()
          .execute('delete from platform_outbox_events where id = ? and locked_by = ?', [
            row.id,
            dispatcherId,
          ])
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await recordFailure(entityManager, dispatcherId, row.id, message)
        logger.error('Outbox event delivery failed', { eventId: row.id, error: message })
      }
    }
  }

  return {
    dispatchOnce: tick,
    start() {
      if (interval) return
      stopped = false
      interval = setInterval(() => void tick(), 500)
      void tick()
    },
    async stop() {
      stopped = true
      if (interval) clearInterval(interval)
      interval = undefined
      await running
    },
  }
}

function collectSubscriptions(moduleCatalog: ModuleCatalog) {
  const subscriptions = new Map<string, RegisteredSubscription[]>()
  for (const module of moduleCatalog.modules) {
    for (const subscription of module.events.subscribes) {
      const registered = subscriptions.get(subscription.event.id) ?? []
      registered.push({
        definition: subscription.event,
        id: eventSubscriptionId(module.id, subscription.event.id),
        subscription,
        validators: new Map(
          subscription.event.versions
            .filter((version) =>
              subscription.supportedVersions.includes(version.schemaVersion as never),
            )
            .map((version) => [version.schemaVersion, Compile(version.payloadSchema)]),
        ),
      })
      subscriptions.set(subscription.event.id, registered)
    }
  }
  return subscriptions
}

async function claimReadyEvents(entityManager: EntityManager, dispatcherId: string) {
  return entityManager.getConnection().execute<ClaimedEventRow[]>(
    `with claimed as (
       select event.id
       from platform_outbox_events as event
       where event.failed_at is null
         and event.next_attempt_at <= now()
         and (event.locked_until is null or event.locked_until < now())
         and not exists (
           select 1
           from platform_outbox_events as earlier
           where earlier.organization_id = event.organization_id
             and earlier.aggregate_id = event.aggregate_id
             and (
               earlier.aggregate_version < event.aggregate_version
               or (
                 earlier.aggregate_version = event.aggregate_version
                 and (earlier.occurred_at, earlier.id) < (event.occurred_at, event.id)
               )
             )
         )
       order by event.occurred_at, event.id
       for update of event skip locked
       limit 50
     )
     update platform_outbox_events as event
     set locked_by = ?, locked_until = now() + interval '30 seconds'
     from claimed
     where event.id = claimed.id
     returning event.*`,
    [dispatcherId],
  )
}

async function deliverToSubscription(
  row: ClaimedEventRow,
  registered: RegisteredSubscription,
  { logger, orm, rootContainer }: { logger: Logger; orm: MikroORM; rootContainer: AppContainer },
) {
  const validator = registered.validators.get(row.schema_version)
  if (!validator) {
    throw new Error(
      `Subscription ${registered.id} does not support ${row.type} schema version ${row.schema_version}`,
    )
  }
  if (!validator.Check(row.payload)) {
    const errors = validator
      .Errors(row.payload)
      .map((error) => `${error.instancePath || '/'} ${error.message}`)
      .join(', ')
    throw new Error(`Invalid ${row.type} v${row.schema_version} payload: ${errors}`)
  }

  const entityManager = orm.em.fork()
  await entityManager.transactional(async (transaction) => {
    const inserted = await transaction.execute<Array<{ id: string }>>(
      `insert into platform_event_inbox (
         id, aggregate_id, aggregate_version, event_id, event_type, organization_id, processed_at,
         schema_version, subscription_id
       ) values (?, ?, ?, ?, ?, ?, null, ?, ?)
       on conflict (subscription_id, event_id) do nothing
       returning id`,
      [
        randomUUID(),
        row.aggregate_id,
        row.aggregate_version,
        row.id,
        row.type,
        row.organization_id,
        row.schema_version,
        registered.id,
      ],
    )
    const inboxMarker = inserted[0]
    if (!inboxMarker) return

    const eventLogger = logger.child({
      correlationId: row.correlation_id,
      eventId: row.id,
      eventType: row.type,
      subscriptionId: registered.id,
    })
    const scope = rootContainer.createScope()
    scope.register({
      entityManager: asValue(transaction),
      logger: asValue(eventLogger),
    })

    try {
      const event: PublishedEvent = {
        aggregateId: row.aggregate_id,
        aggregateVersion: row.aggregate_version,
        payload: row.payload,
        schemaVersion: row.schema_version,
        type: registered.definition.id,
      }
      await registered.subscription.handle(event, {
        actor: { id: row.actor_id, type: row.actor_type },
        correlationId: row.correlation_id,
        entityManager: scope.resolve('entityManager'),
        eventId: row.id,
        logger: scope.resolve('logger'),
        occurredAt: parseOccurredAt(row.occurred_at),
        organizationId: row.organization_id as OrganizationId,
      })
    } finally {
      await scope.dispose()
    }
    await transaction.execute(
      'update platform_event_inbox set processed_at = clock_timestamp() where id = ?',
      [inboxMarker.id],
    )
  })
}

function parseOccurredAt(value: Date | string) {
  const occurredAt = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(occurredAt.valueOf())) throw new Error(`Invalid event occurrence time: ${value}`)
  return occurredAt
}

async function recordFailure(
  entityManager: EntityManager,
  dispatcherId: string,
  eventId: string,
  message: string,
) {
  await entityManager.getConnection().execute(
    `update platform_outbox_events
     set attempts = attempts + 1,
         last_error = ?,
         locked_by = null,
         locked_until = null,
         next_attempt_at = now() + make_interval(secs => least(300, power(2, attempts + 1)::int)),
         failed_at = case when attempts + 1 >= 10 then now() else null end
     where id = ? and locked_by = ?`,
    [message, eventId, dispatcherId],
  )
}
