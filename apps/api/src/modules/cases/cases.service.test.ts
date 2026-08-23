import type { EntityManager } from '@mikro-orm/postgresql'
import type {
  CaseId,
  ChangeCaseStatusRequest,
  CreateCaseRequest,
  ListCasesQuery,
  OrganizationId,
  UpdateCaseRequest,
} from '@yetano/contracts'
import { describe, expect, it, vi } from 'vitest'

import type { ExecutionContext } from '../../platform/execution/context.js'
import type { OperationExecutor } from '../../platform/execution/operation.js'
import { CaseValidationError, createCasesService } from './cases.service.js'

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

describe('cases service domain validation', () => {
  it.each([
    {
      name: 'an overlong title',
      request: { title: 'x'.repeat(201) } as unknown as CreateCaseRequest,
    },
    {
      name: 'an overlong description',
      request: {
        description: 'x'.repeat(10_001),
        title: 'Valid title',
      } as unknown as CreateCaseRequest,
    },
  ])('rejects $name on create before executing the operation', ({ request }) => {
    const { execute, service } = serviceWithMockExecutor()

    expect(() => service.create(request, executionContext)).toThrow(CaseValidationError)
    expect(execute).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'an overlong title',
      request: { expectedVersion: 1, title: 'x'.repeat(201) } as unknown as UpdateCaseRequest,
    },
    {
      name: 'an overlong description',
      request: {
        description: 'x'.repeat(10_001),
        expectedVersion: 1,
      } as unknown as UpdateCaseRequest,
    },
  ])('rejects $name on update before executing the operation', ({ request }) => {
    const { execute, service } = serviceWithMockExecutor()

    expect(() => service.update(caseId, request, executionContext)).toThrow(CaseValidationError)
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects a forbidden transition passed directly to the service', async () => {
    const { execute, service } = serviceWithMockExecutor()
    const request = {
      expectedVersion: 1,
      fromStatus: 'working',
      toStatus: 'postponed',
      transitionId: 'cbf25145-a709-47b7-885b-b458b869e174',
    } as unknown as ChangeCaseStatusRequest

    await expect(service.transition(caseId, request, executionContext)).rejects.toThrow(
      CaseValidationError,
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'a blank required note',
      request: {
        expectedVersion: 1,
        fromStatus: 'working',
        note: '   ',
        toStatus: 'waiting',
        transitionId: 'cbf25145-a709-47b7-885b-b458b869e174',
      } as unknown as ChangeCaseStatusRequest,
    },
    {
      name: 'an overlong note',
      request: {
        expectedVersion: 1,
        fromStatus: 'working',
        note: 'x'.repeat(2_001),
        toStatus: 'resolved',
        transitionId: 'cbf25145-a709-47b7-885b-b458b869e174',
      } as unknown as ChangeCaseStatusRequest,
    },
    {
      name: 'a note on a note-free transition',
      request: {
        expectedVersion: 1,
        fromStatus: 'new',
        note: 'Later',
        toStatus: 'postponed',
        transitionId: 'cbf25145-a709-47b7-885b-b458b869e174',
      } as unknown as ChangeCaseStatusRequest,
    },
  ])('rejects $name before executing a transition', async ({ request }) => {
    const { execute, service } = serviceWithMockExecutor()

    await expect(service.transition(caseId, request, executionContext)).rejects.toThrow(
      CaseValidationError,
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'an out-of-range limit',
      request: { limit: 101 } as unknown as ListCasesQuery,
    },
    {
      name: 'a blank search',
      request: { search: '   ' } as unknown as ListCasesQuery,
    },
  ])('rejects $name on list before executing the query', ({ request }) => {
    const { execute, service } = serviceWithMockExecutor()

    expect(() => service.list(request, executionContext)).toThrow(CaseValidationError)
    expect(execute).not.toHaveBeenCalled()
  })

  it('allows status and statusGroup to define an intersection', () => {
    const { execute, service } = serviceWithMockExecutor()
    const request = { status: ['new'] as const, statusGroup: 'open' as const }

    expect(() => service.list(request, executionContext)).not.toThrow()
    expect(execute).toHaveBeenCalledWith(
      expect.anything(),
      executionContext,
      request,
      expect.any(Function),
    )
  })
})

function serviceWithMockExecutor() {
  const execute = vi.fn()
  return {
    execute,
    service: createCasesService({
      entityManager: {} as EntityManager,
      operationExecutor: { execute } as unknown as OperationExecutor,
    }),
  }
}

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
