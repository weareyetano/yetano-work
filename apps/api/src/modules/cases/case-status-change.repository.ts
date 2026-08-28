import type { EntityManager } from '@mikro-orm/postgresql'
import type { OrganizationId } from '@yetano/contracts'

import { CaseStatusChangeEntity, type CaseStatusChangeRecord } from './case-status-change.entity.js'

export interface CaseStatusChangeRepository {
  findByTransitionId(
    organizationId: OrganizationId,
    transitionId: string,
  ): Promise<CaseStatusChangeRecord | null>
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
  }
}
