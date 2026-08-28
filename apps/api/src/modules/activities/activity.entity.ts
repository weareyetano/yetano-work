import { defineEntity, type InferEntity, p } from '@mikro-orm/core'
import type { CaseId, CaseStatus, OrganizationId } from '@yetano/contracts'

export const ActivityEntity = defineEntity({
  indexes: [
    {
      name: 'activities_org_case_occurred_idx',
      properties: ['organizationId', 'caseId', 'occurredAt', 'id'],
    },
  ],
  name: 'Activity',
  properties: {
    actorId: p.string().length(255).fieldName('actor_id'),
    actorType: p.enum(['system', 'user'] as const).fieldName('actor_type'),
    body: p.text().nullable(),
    caseId: p.uuid().$type<CaseId>().fieldName('case_id'),
    caseVersion: p.integer().fieldName('case_version').nullable(),
    fromStatus: p
      .enum(['canceled', 'new', 'postponed', 'resolved', 'waiting', 'working'] as const)
      .$type<CaseStatus>()
      .fieldName('from_status')
      .nullable(),
    id: p.uuid().primary(),
    occurredAt: p.datetime().fieldName('occurred_at'),
    organizationId: p.uuid().$type<OrganizationId>().fieldName('organization_id'),
    toStatus: p
      .enum(['canceled', 'new', 'postponed', 'resolved', 'waiting', 'working'] as const)
      .$type<CaseStatus>()
      .fieldName('to_status')
      .nullable(),
    type: p.enum(['case_created', 'case_status_changed', 'note'] as const),
  },
  tableName: 'activities',
})

export type ActivityRecord = InferEntity<typeof ActivityEntity>
