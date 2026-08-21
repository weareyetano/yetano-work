import { defineEntity, type InferEntity, p } from '@mikro-orm/core'
import type { CaseId, CustomerId, OrganizationId } from '@yetano/contracts'

export const CaseEntity = defineEntity({
  indexes: [
    {
      name: 'cases_org_updated_idx',
      properties: ['organizationId', 'updatedAt', 'id'],
    },
    {
      name: 'cases_org_status_updated_idx',
      properties: ['organizationId', 'status', 'updatedAt', 'id'],
    },
    {
      name: 'cases_org_customer_updated_idx',
      properties: ['organizationId', 'customerId', 'updatedAt', 'id'],
    },
  ],
  name: 'Case',
  properties: {
    closedAt: p.datetime().fieldName('closed_at').nullable(),
    createdAt: p.datetime().fieldName('created_at'),
    customerId: p.uuid().$type<CustomerId>().fieldName('customer_id').nullable(),
    description: p.text().nullable(),
    id: p.uuid().$type<CaseId>().primary(),
    organizationId: p.uuid().$type<OrganizationId>().fieldName('organization_id'),
    status: p.enum(['canceled', 'new', 'postponed', 'resolved', 'waiting', 'working'] as const),
    statusNote: p.text().fieldName('status_note').nullable(),
    title: p.string().length(200),
    updatedAt: p.datetime().fieldName('updated_at'),
    version: p.integer().version().default(1),
  },
  tableName: 'cases',
})

export type CaseRecord = InferEntity<typeof CaseEntity>
