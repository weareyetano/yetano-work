import type { EntityManager } from '@mikro-orm/postgresql'
import type { CaseId, ChangeCaseStatusRequest, OrganizationId } from '@yetano/contracts'
import { describe, expect, it, vi } from 'vitest'

import type { ExecutionContext } from '../../platform/execution/context.js'
import type { OperationExecutor } from '../../platform/execution/operation.js'
import { createCasesService } from './cases.service.js'

const caseId = '122c8615-6bcd-4a36-90e6-d18ca0c06928' as CaseId
const organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb' as OrganizationId

describe('cases service transition authorization routing', () => {
  it.each([
    {
      capability: 'cases.transition',
      request: command({ fromStatus: 'new', toStatus: 'working' }),
    },
    {
      capability: 'cases.transition',
      request: command({ fromStatus: 'new', toStatus: 'postponed' }),
    },
    {
      capability: 'cases.transition',
      request: command({ fromStatus: 'postponed', toStatus: 'new' }),
    },
    {
      capability: 'cases.close',
      request: command({ fromStatus: 'working', toStatus: 'resolved' }),
    },
    {
      capability: 'cases.close',
      request: command({ fromStatus: 'postponed', toStatus: 'resolved' }),
    },
    {
      capability: 'cases.reopen',
      request: command({ fromStatus: 'resolved', toStatus: 'working' }),
    },
  ])('selects $capability from the declared status pair', async ({ capability, request }) => {
    const stop = new Error('stop before persistence')
    const execute = vi.fn().mockRejectedValue(stop)
    const service = createCasesService({
      entityManager: {} as EntityManager,
      operationExecutor: { execute } as unknown as OperationExecutor,
    })

    await expect(service.transition(caseId, request, executionContext)).rejects.toBe(stop)
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ capability })
  })
})

function command(
  statuses:
    | { fromStatus: 'new'; toStatus: 'working' }
    | { fromStatus: 'new'; toStatus: 'postponed' }
    | { fromStatus: 'postponed'; toStatus: 'new' }
    | { fromStatus: 'postponed'; toStatus: 'resolved' }
    | { fromStatus: 'working'; toStatus: 'resolved' }
    | { fromStatus: 'resolved'; toStatus: 'working' },
): ChangeCaseStatusRequest {
  return {
    expectedVersion: 1,
    transitionId: 'cbf25145-a709-47b7-885b-b458b869e174',
    ...statuses,
  }
}

const executionContext: ExecutionContext = {
  actor: { id: 'test-user', type: 'user' },
  capabilities: new Set(['cases.close', 'cases.read', 'cases.reopen', 'cases.transition']),
  correlationId: 'correlation-id',
  organizationId,
  requestId: 'request-id',
}
