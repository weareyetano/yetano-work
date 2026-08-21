import type { FilterQuery } from '@mikro-orm/core'
import { type EntityManager, raw } from '@mikro-orm/postgresql'
import type {
  CaseId,
  CaseStatus,
  CaseStatusGroup,
  CustomerId,
  OrganizationId,
} from '@yetano/contracts'

import { CaseEntity, type CaseRecord } from './case.entity.js'

export interface CaseCursor {
  id: CaseId
  updatedAt: Date
}

export interface CaseListFilters {
  cursor?: CaseCursor
  customerId?: CustomerId
  limit: number
  search?: string
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
      const conjunctions: FilterQuery<CaseRecord>[] = []
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
      if (filters.search) {
        const pattern = `%${escapeLikePattern(filters.search)}%`
        conjunctions.push({
          $or: [
            { title: { $ilike: pattern } },
            { description: { $ilike: pattern } },
            { [raw((alias) => `cast(${alias}.id as text)`)]: { $ilike: pattern } },
          ],
        })
      }
      if (filters.cursor) {
        conjunctions.push({
          $or: [
            { updatedAt: { $lt: filters.cursor.updatedAt } },
            { id: { $lt: filters.cursor.id }, updatedAt: filters.cursor.updatedAt },
          ],
        })
      }
      if (conjunctions.length > 0) where.$and = conjunctions

      const records = await entityManager.find(CaseEntity, where, {
        limit: filters.limit + 1,
        orderBy: [{ updatedAt: 'DESC' }, { id: 'DESC' }],
      })
      return {
        hasMore: records.length > filters.limit,
        items: records.slice(0, filters.limit),
      }
    },
  }
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}
