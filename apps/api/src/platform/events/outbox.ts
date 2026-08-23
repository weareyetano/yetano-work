import { randomUUID } from 'node:crypto'

import type { EntityManager } from '@mikro-orm/postgresql'

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

export function createOutboxWriter(): OutboxWriter {
  return {
    async append(entityManager, context, events) {
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
