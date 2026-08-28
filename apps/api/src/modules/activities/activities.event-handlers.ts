import type { EntityManager } from '@mikro-orm/postgresql'
import type { caseCreatedEvent, caseTransitionedEvent } from '../cases/index.js'
import type { EventSubscriptionHandler } from '../module.js'
import { ActivityEntity } from './activity.entity.js'

export function createCaseCreatedActivityHandler({
  entityManager,
}: {
  entityManager: EntityManager
}): EventSubscriptionHandler<typeof caseCreatedEvent, readonly [1]> {
  return {
    async handle(event, context) {
      const record = entityManager.create(ActivityEntity, {
        actorId: context.actor.id,
        actorType: context.actor.type,
        body: null,
        caseId: event.payload.caseId,
        caseVersion: event.payload.caseVersion,
        fromStatus: null,
        id: context.eventId,
        occurredAt: context.occurredAt,
        organizationId: context.organizationId,
        toStatus: null,
        type: 'case_created',
      })
      entityManager.persist(record)
      await entityManager.flush()
    },
  }
}

export function createCaseTransitionedActivityHandler({
  entityManager,
}: {
  entityManager: EntityManager
}): EventSubscriptionHandler<typeof caseTransitionedEvent, readonly [1, 2, 3]> {
  return {
    async handle(event, context) {
      const record = entityManager.create(ActivityEntity, {
        actorId: context.actor.id,
        actorType: context.actor.type,
        body: event.schemaVersion === 3 ? event.payload.note : null,
        caseId: event.payload.caseId,
        caseVersion: event.payload.caseVersion,
        fromStatus: event.payload.fromStatus,
        id: context.eventId,
        occurredAt: context.occurredAt,
        organizationId: context.organizationId,
        toStatus: event.payload.toStatus,
        type: 'case_status_changed',
      })
      entityManager.persist(record)
      await entityManager.flush()
    },
  }
}
