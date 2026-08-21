import type { FilterQuery } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CaseId, OrganizationId } from '@yetano/contracts'

import { CaseStatusChangeEntity, type CaseStatusChangeRecord } from './case-status-change.entity.js'

export interface CaseStatusHistoryCursor {
  changedAt: Date
  id: string
}

export interface CaseStatusChangeRepository {
  findByTransitionId(
    organizationId: OrganizationId,
    transitionId: string,
  ): Promise<CaseStatusChangeRecord | null>
  list(
    organizationId: OrganizationId,
    caseId: CaseId,
    filters: { cursor?: CaseStatusHistoryCursor; limit: number },
  ): Promise<{ hasMore: boolean; items: CaseStatusChangeRecord[] }>
}

export function createCaseStatusChangeRepository(
  entityManager: EntityManager,
): CaseStatusChangeRepository {
  return {
    findByTransitionId(organizationId, transitionId) {
      return entityManager.findOne(
        CaseStatusChangeEntity,
        { organizationId, transitionId },
        { refresh: true },
      )
    },
    async list(organizationId, caseId, filters) {
      const where: FilterQuery<CaseStatusChangeRecord> = { caseId, organizationId }
      if (filters.cursor) {
        where.$or = [
          { changedAt: { $lt: filters.cursor.changedAt } },
          { changedAt: filters.cursor.changedAt, id: { $lt: filters.cursor.id } },
        ]
      }
      const records = await entityManager.find(CaseStatusChangeEntity, where, {
        limit: filters.limit + 1,
        orderBy: [{ changedAt: 'DESC' }, { id: 'DESC' }],
      })
      return {
        hasMore: records.length > filters.limit,
        items: records.slice(0, filters.limit),
      }
    },
  }
}
