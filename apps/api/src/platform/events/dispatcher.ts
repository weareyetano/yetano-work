import { randomUUID } from 'node:crypto'

import type { MikroORM } from '@mikro-orm/postgresql'

import type { Logger } from '../../logger.js'
import type { ModuleCatalog } from '../../modules/catalog.js'
import type { PublishedEventEnvelope } from '../../modules/module.js'

interface ClaimedEventRow {
  actor_id: string
  actor_type: 'system' | 'user'
  aggregate_id: string
  aggregate_version: number
  correlation_id: string
  id: string
  organization_id: string
  payload: Record<string, unknown>
  schema_version: number
  type: string
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
}: {
  logger: Logger
  moduleCatalog: ModuleCatalog
  orm: MikroORM
}): OutboxDispatcher {
  const dispatcherId = randomUUID()
  const handlers = new Map<string, Array<(event: PublishedEventEnvelope) => Promise<void>>>()
  for (const module of moduleCatalog.modules) {
    for (const subscription of module.events.subscribes) {
      const registered = handlers.get(subscription.eventId) ?? []
      registered.push(subscription.handle)
      handlers.set(subscription.eventId, registered)
    }
  }

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
    const rows = await entityManager.getConnection().execute<ClaimedEventRow[]>(
      `with claimed as (
         select id
         from platform_outbox_events
         where failed_at is null
           and next_attempt_at <= now()
           and (locked_until is null or locked_until < now())
         order by occurred_at, id
         for update skip locked
         limit 50
       )
       update platform_outbox_events as event
       set locked_by = ?, locked_until = now() + interval '30 seconds'
       from claimed
       where event.id = claimed.id
       returning event.*`,
      [dispatcherId],
    )

    for (const row of rows) {
      const envelope: PublishedEventEnvelope = {
        actorId: row.actor_id,
        actorType: row.actor_type,
        aggregateId: row.aggregate_id,
        aggregateVersion: row.aggregate_version,
        correlationId: row.correlation_id,
        eventId: row.id,
        organizationId: row.organization_id,
        payload: row.payload,
        schemaVersion: row.schema_version,
        type: row.type,
      }

      try {
        for (const handle of handlers.get(row.type) ?? []) await handle(envelope)
        await entityManager
          .getConnection()
          .execute('delete from platform_outbox_events where id = ? and locked_by = ?', [
            row.id,
            dispatcherId,
          ])
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await entityManager.getConnection().execute(
          `update platform_outbox_events
           set attempts = attempts + 1,
               last_error = ?,
               locked_by = null,
               locked_until = null,
               next_attempt_at = now() + make_interval(secs => least(300, power(2, attempts + 1)::int)),
               failed_at = case when attempts + 1 >= 10 then now() else null end
           where id = ? and locked_by = ?`,
          [message, row.id, dispatcherId],
        )
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
