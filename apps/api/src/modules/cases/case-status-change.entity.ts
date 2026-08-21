import { defineEntity, type InferEntity, p } from '@mikro-orm/core'
import type { CaseId, CaseStatus, OrganizationId } from '@yetano/contracts'

export const CaseStatusChangeEntity = defineEntity({
  indexes: [
    {
      name: 'case_status_changes_org_case_changed_idx',
      properties: ['organizationId', 'caseId', 'changedAt', 'id'],
    },
  ],
  name: 'CaseStatusChange',
  properties: {
    actorId: p.string().length(255).fieldName('actor_id'),
    actorType: p.enum(['system', 'user'] as const).fieldName('actor_type'),
    caseId: p.uuid().$type<CaseId>().fieldName('case_id'),
    caseVersion: p.integer().fieldName('case_version'),
    changedAt: p.datetime().fieldName('changed_at'),
    expectedVersion: p.integer().fieldName('expected_version').nullable(),
    fromStatus: p
      .enum(['canceled', 'new', 'postponed', 'resolved', 'waiting', 'working'] as const)
      .$type<CaseStatus>()
      .fieldName('from_status')
      .nullable(),
    id: p.uuid().primary(),
    note: p.text().nullable(),
    organizationId: p.uuid().$type<OrganizationId>().fieldName('organization_id'),
    source: p.enum(['migration', 'runtime'] as const),
    toStatus: p
      .enum(['canceled', 'new', 'postponed', 'resolved', 'waiting', 'working'] as const)
      .$type<CaseStatus>()
      .fieldName('to_status'),
    transitionId: p.uuid().fieldName('transition_id').nullable(),
    type: p.enum(['created', 'transitioned'] as const),
  },
  tableName: 'case_status_changes',
  uniques: [
    {
      name: 'case_status_changes_org_transition_unique',
      properties: ['organizationId', 'transitionId'],
    },
  ],
})

export type CaseStatusChangeRecord = InferEntity<typeof CaseStatusChangeEntity>
