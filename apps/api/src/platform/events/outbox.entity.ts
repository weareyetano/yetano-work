import { defineEntity, type InferEntity, p } from '@mikro-orm/core'

export const OutboxEventEntity = defineEntity({
  indexes: [{ name: 'platform_outbox_ready_idx', properties: ['nextAttemptAt', 'occurredAt'] }],
  name: 'OutboxEvent',
  properties: {
    actorId: p.string().fieldName('actor_id'),
    actorType: p.enum(['system', 'user'] as const).fieldName('actor_type'),
    aggregateId: p.string().fieldName('aggregate_id'),
    aggregateVersion: p.integer().fieldName('aggregate_version'),
    attempts: p.integer().default(0),
    correlationId: p.string().fieldName('correlation_id'),
    failedAt: p.datetime().fieldName('failed_at').nullable(),
    id: p.uuid().primary(),
    lastError: p.text().fieldName('last_error').nullable(),
    lockedBy: p.string().fieldName('locked_by').nullable(),
    lockedUntil: p.datetime().fieldName('locked_until').nullable(),
    nextAttemptAt: p.datetime().fieldName('next_attempt_at'),
    occurredAt: p.datetime().fieldName('occurred_at'),
    organizationId: p.uuid().fieldName('organization_id'),
    payload: p.json<Record<string, unknown>>(),
    schemaVersion: p.integer().fieldName('schema_version'),
    type: p.string(),
  },
  tableName: 'platform_outbox_events',
})

export type OutboxEvent = InferEntity<typeof OutboxEventEntity>
