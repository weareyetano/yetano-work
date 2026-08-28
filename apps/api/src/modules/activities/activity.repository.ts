import type { FilterQuery } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CaseId, OrganizationId } from '@yetano/contracts'

import { ActivityEntity, type ActivityRecord } from './activity.entity.js'

export interface ActivityCursor {
  id: string
  occurredAt: Date
}

export interface ActivityRepository {
  findById(id: string): Promise<ActivityRecord | null>
  list(
    organizationId: OrganizationId,
    caseId: CaseId,
    filters: { cursor?: ActivityCursor; limit: number },
  ): Promise<{ hasMore: boolean; items: ActivityRecord[] }>
}

export function createActivityRepository(entityManager: EntityManager): ActivityRepository {
  return {
    findById(id) {
      return entityManager.findOne(ActivityEntity, { id }, { refresh: true })
    },
    async list(organizationId, caseId, filters) {
      const where: FilterQuery<ActivityRecord> = { caseId, organizationId }
      if (filters.cursor) {
        where.$or = [
          { occurredAt: { $lt: filters.cursor.occurredAt } },
          { id: { $lt: filters.cursor.id }, occurredAt: filters.cursor.occurredAt },
        ]
      }
      const records = await entityManager.find(ActivityEntity, where, {
        limit: filters.limit + 1,
        orderBy: [{ occurredAt: 'DESC' }, { id: 'DESC' }],
      })
      return {
        hasMore: records.length > filters.limit,
        items: records.slice(0, filters.limit),
      }
    },
  }
}
