import type { FilterQuery } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import type {
  CaseId,
  CaseStatus,
  CaseStatusGroup,
  CustomerId,
  OrganizationId,
} from '@yetano/contracts'

import { CaseEntity, type CaseRecord } from './case.entity.js'

export interface CaseCursor {
  createdAt: Date
  id: CaseId
}

export interface CaseListFilters {
  cursor?: CaseCursor
  customerId?: CustomerId
  limit: number
  status?: CaseStatus | CaseStatus[]
  statusGroup?: CaseStatusGroup
}

export interface CaseRepository {
  findById(organizationId: OrganizationId, caseId: CaseId): Promise<CaseRecord | null>
  list(
    organizationId: OrganizationId,
    filters: CaseListFilters,
  ): Promise<{ items: CaseRecord[]; hasMore: boolean }>
}

export function createCaseRepository(entityManager: EntityManager): CaseRepository {
  return {
    findById(organizationId, caseId) {
      return entityManager.findOne(CaseEntity, { id: caseId, organizationId })
    },
    async list(organizationId, filters) {
      const where: FilterQuery<CaseRecord> = { organizationId }
      if (filters.status) {
        where.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status
      }
      if (filters.statusGroup) {
        where.status = {
          $in:
            filters.statusGroup === 'open'
              ? ['new', 'waiting', 'working']
              : ['canceled', 'resolved'],
        }
      }
      if (filters.customerId) where.customerId = filters.customerId
      if (filters.cursor) {
        where.$or = [
          { createdAt: { $lt: filters.cursor.createdAt } },
          { createdAt: filters.cursor.createdAt, id: { $lt: filters.cursor.id } },
        ]
      }

      const records = await entityManager.find(CaseEntity, where, {
        limit: filters.limit + 1,
        orderBy: [{ createdAt: 'DESC' }, { id: 'DESC' }],
      })
      return {
        hasMore: records.length > filters.limit,
        items: records.slice(0, filters.limit),
      }
    },
  }
}
