import type { EntityManager } from '@mikro-orm/postgresql'
import type { CaseId, OrganizationId } from '@yetano/contracts'
import { describe, expect, it, vi } from 'vitest'

import { CaseEntity, type CaseRecord } from './case.entity.js'
import { createCasesReadPort } from './cases.read-port.js'

const caseId = '122c8615-6bcd-4a36-90e6-d18ca0c06928' as CaseId
const organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb' as OrganizationId

describe('cases read port', () => {
  it('returns a serialized case through an organization-scoped lookup', async () => {
    const record = {
      closedAt: null,
      createdAt: new Date('2026-08-23T10:00:00.000Z'),
      customerId: null,
      description: null,
      id: caseId,
      organizationId,
      status: 'new',
      statusNote: null,
      title: 'Timeline source',
      updatedAt: new Date('2026-08-23T10:00:00.000Z'),
      version: 1,
    } as CaseRecord
    const findOne = vi.fn().mockResolvedValue(record)
    const port = createCasesReadPort({
      entityManager: { findOne } as unknown as EntityManager,
    })

    await expect(port.findById(organizationId, caseId)).resolves.toEqual({
      closedAt: null,
      createdAt: '2026-08-23T10:00:00.000Z',
      customerId: null,
      description: null,
      id: caseId,
      organizationId,
      status: 'new',
      statusNote: null,
      title: 'Timeline source',
      updatedAt: '2026-08-23T10:00:00.000Z',
      version: 1,
    })
    expect(findOne).toHaveBeenCalledWith(CaseEntity, { id: caseId, organizationId })
  })
})
