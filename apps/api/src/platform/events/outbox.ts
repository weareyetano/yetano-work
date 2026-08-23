import { randomUUID } from 'node:crypto'

import type { EntityManager } from '@mikro-orm/postgresql'
import { Compile } from 'typebox/compile'

import type { ModuleCatalog } from '../../modules/catalog.js'
import type { CurrentEventPayload, EventDefinition } from '../../modules/module.js'
import type { ExecutionContext } from '../execution/context.js'
import { OutboxEventEntity } from './outbox.entity.js'

export interface PendingDomainEvent<Definition extends EventDefinition = EventDefinition> {
  aggregateId: string
  aggregateVersion: number
  definition: Definition
  occurredAt?: Date
  payload: CurrentEventPayload<Definition>
}

export interface OutboxWriter {
  append(
    entityManager: EntityManager,
    context: ExecutionContext,
    events: readonly PendingDomainEvent[],
  ): Promise<void>
}

export function createOutboxWriter({
  moduleCatalog,
}: {
  moduleCatalog: ModuleCatalog
}): OutboxWriter {
  const registeredEvents = new Map(
    [...moduleCatalog.events].map(([eventId, definition]) => {
      const currentVersion = definition.versions.find(
        (version) => version.schemaVersion === definition.schemaVersion,
      )
      if (!currentVersion) {
        throw new Error(
          `Event ${eventId} current schema version ${definition.schemaVersion} is not declared`,
        )
      }
      return [eventId, { definition, validator: Compile(currentVersion.payloadSchema) }] as const
    }),
  )

  return {
    async append(entityManager, context, events) {
      for (const event of events) validateEvent(event, registeredEvents)

      const appendedAt = new Date()
      for (const event of events) {
        const occurredAt = event.occurredAt ?? appendedAt
        entityManager.persist(
          entityManager.create(OutboxEventEntity, {
            actorId: context.actor.id,
            actorType: context.actor.type,
            aggregateId: event.aggregateId,
            aggregateVersion: event.aggregateVersion,
            attempts: 0,
            correlationId: context.correlationId,
            failedAt: null,
            id: randomUUID(),
            lastError: null,
            lockedBy: null,
            lockedUntil: null,
            nextAttemptAt: occurredAt,
            occurredAt,
            organizationId: context.organizationId,
            payload: event.payload,
            schemaVersion: event.definition.schemaVersion,
            type: event.definition.id,
          }),
        )
      }
      if (events.length > 0) await entityManager.flush()
    },
  }
}

function validateEvent(
  event: PendingDomainEvent,
  registeredEvents: ReadonlyMap<
    string,
    { definition: EventDefinition; validator: ReturnType<typeof Compile> }
  >,
) {
  const registered = registeredEvents.get(event.definition.id)
  if (!registered) {
    throw new Error(`Event ${event.definition.id} is not registered in the module catalog`)
  }
  if (registered.definition !== event.definition) {
    throw new Error(
      `Event ${event.definition.id} must use the contract registered in the module catalog`,
    )
  }
  if (registered.validator.Check(event.payload)) return

  const errors = registered.validator
    .Errors(event.payload)
    .map((error) => `${error.instancePath || '/'} ${error.message}`)
    .join(', ')
  throw new Error(
    `Invalid ${event.definition.id} v${event.definition.schemaVersion} payload: ${errors}`,
  )
}
