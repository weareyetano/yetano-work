import { defineEntity, type InferEntity, p } from '@mikro-orm/core'
import type { OrganizationId } from '@yetano/contracts'

export const InboxEventEntity = defineEntity({
  indexes: [
    {
      name: 'platform_event_inbox_aggregate_idx',
      properties: ['organizationId', 'aggregateId', 'aggregateVersion'],
    },
  ],
  name: 'InboxEvent',
  properties: {
    aggregateId: p.string().length(255).fieldName('aggregate_id'),
    aggregateVersion: p.integer().fieldName('aggregate_version'),
    eventId: p.uuid().fieldName('event_id'),
    eventType: p.string().length(255).fieldName('event_type'),
    id: p.uuid().primary(),
    organizationId: p.uuid().$type<OrganizationId>().fieldName('organization_id'),
    processedAt: p.datetime().nullable().fieldName('processed_at'),
    schemaVersion: p.integer().fieldName('schema_version'),
    subscriptionId: p.string().length(511).fieldName('subscription_id'),
  },
  tableName: 'platform_event_inbox',
  uniques: [
    {
      name: 'platform_event_inbox_subscription_event_unique',
      properties: ['subscriptionId', 'eventId'],
    },
  ],
})

export type InboxEvent = InferEntity<typeof InboxEventEntity>
