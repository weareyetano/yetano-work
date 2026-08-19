import { OptimisticLockError } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CaseId, OrganizationId } from '@yetano/contracts'
import { describe, expect, it, vi } from 'vitest'

import type { ExecutionContext } from '../../platform/execution/context.js'
import type { OperationExecutor } from '../../platform/execution/operation.js'
import { CaseEntity, type CaseRecord } from './case.entity.js'
import { type CaseVersionConflictError, createCasesService } from './cases.service.js'

const caseId = '122c8615-6bcd-4a36-90e6-d18ca0c06928' as CaseId
const organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb' as OrganizationId

describe('cases service optimistic conflict recovery', () => {
  it.each([
    {
      action: 'close' as const,
      closedAt: new Date('2026-08-19T11:00:00.000Z'),
      status: 'closed' as const,
    },
    { action: 'reopen' as const, closedAt: null, status: 'open' as const },
  ])(
    'returns the current case when concurrent $action already reached its target',
    async (scenario) => {
      const record = caseRecord({
        closedAt: scenario.closedAt,
        status: scenario.status,
        version: 2,
      })
      const { findOne, service } = conflictService(record)

      const result = await service[scenario.action](
        caseId,
        { expectedVersion: 1 },
        executionContext,
      )

      expect(result).toMatchObject({ id: caseId, status: scenario.status, version: 2 })
      expect(findOne).toHaveBeenCalledWith(
        CaseEntity,
        { id: caseId, organizationId },
        { refresh: true },
      )
    },
  )

  it('keeps returning a version conflict when a concurrent close did not reach its target', async () => {
    const { service } = conflictService(caseRecord({ status: 'open', version: 2 }))

    await expect(
      service.close(caseId, { expectedVersion: 1 }, executionContext),
    ).rejects.toMatchObject<CaseVersionConflictError>({ currentVersion: 2 })
  })
})

function conflictService(record: CaseRecord) {
  const findOne = vi.fn().mockResolvedValue(record)
  const operationExecutor = {
    execute: vi.fn().mockRejectedValue(OptimisticLockError.lockFailed('Case')),
  } as unknown as OperationExecutor
  const service = createCasesService({
    entityManager: { findOne } as unknown as EntityManager,
    operationExecutor,
  })
  return { findOne, service }
}

function caseRecord(overrides: Partial<CaseRecord>): CaseRecord {
  return {
    closedAt: null,
    createdAt: new Date('2026-08-19T10:00:00.000Z'),
    customerId: null,
    description: null,
    id: caseId,
    organizationId,
    status: 'open',
    title: 'Lifecycle test',
    updatedAt: new Date('2026-08-19T11:00:00.000Z'),
    version: 1,
    ...overrides,
  }
}

const executionContext: ExecutionContext = {
  actor: { id: 'test-user', type: 'user' },
  capabilities: new Set(['cases.close', 'cases.read']),
  correlationId: 'correlation-id',
  organizationId,
  requestId: 'request-id',
}
