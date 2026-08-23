import type { EntityManager } from '@mikro-orm/postgresql'
import type { Case, CaseId, OrganizationId } from '@yetano/contracts'

import { createCaseRepository } from './case.repository.js'
import { toCase } from './cases.service.js'

export interface CasesReadPort {
  findById(organizationId: OrganizationId, caseId: CaseId): Promise<Case | null>
}

export function createCasesReadPort({
  entityManager,
}: {
  entityManager: EntityManager
}): CasesReadPort {
  return {
    async findById(organizationId, caseId) {
      const record = await createCaseRepository(entityManager).findById(organizationId, caseId)
      return record ? toCase(record) : null
    },
  }
}
