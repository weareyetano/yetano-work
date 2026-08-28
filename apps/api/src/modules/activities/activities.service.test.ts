import type { EntityManager } from '@mikro-orm/postgresql'
import type { CaseId, OrganizationId } from '@yetano/contracts'
import { describe, expect, it, vi } from 'vitest'

import type { ExecutionContext } from '../../platform/execution/context.js'
import type { OperationExecutor } from '../../platform/execution/operation.js'
import type { CasesReadPort } from '../cases/index.js'
import {
  ActivityCaseNotFoundError,
  ActivityIdConflictError,
  ActivityValidationError,
  createActivitiesService,
  InvalidActivityCursorError,
} from './activities.service.js'
import { ActivityEntity, type ActivityRecord } from './activity.entity.js'

const caseId = '122c8615-6bcd-4a36-90e6-d18ca0c06928' as CaseId
const activityId = '75bb9ef0-b103-4df7-89ce-efcbd2f79728'
const organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb' as OrganizationId

describe('activities service', () => {
  it('normalizes and stores an organization-scoped note', async () => {
    const { casesReadPort, create, execute, flush, persist, service } = serviceFixture(null)

    const result = await service.createNote(
      caseId,
      { activityId, content: '  Follow up tomorrow.\n  ' },
      executionContext,
    )

    expect(result).toMatchObject({
      activity: { content: 'Follow up tomorrow.', id: activityId, type: 'note' },
      created: true,
    })
    expect(casesReadPort.findById).toHaveBeenCalledWith(organizationId, caseId)
    expect(create).toHaveBeenCalledWith(
      ActivityEntity,
      expect.objectContaining({
        actorId: 'test-user',
        body: 'Follow up tomorrow.',
        caseId,
        id: activityId,
        organizationId,
      }),
    )
    expect(persist).toHaveBeenCalled()
    expect(flush).toHaveBeenCalled()
    expect(execute).toHaveBeenCalled()
  })

  it('returns an exact replay and rejects reuse for another command', async () => {
    const stored = noteRecord()
    const exact = serviceFixture(stored)
    const conflict = serviceFixture(stored)

    await expect(
      exact.service.createNote(
        caseId,
        { activityId, content: 'Follow up tomorrow.' },
        executionContext,
      ),
    ).resolves.toMatchObject({ created: false })
    expect(exact.casesReadPort.findById).toHaveBeenCalledWith(organizationId, caseId)

    await expect(
      conflict.service.createNote(
        caseId,
        { activityId, content: 'Different note' },
        executionContext,
      ),
    ).rejects.toThrow(ActivityIdConflictError)
  })

  it.each([
    {
      name: 'another case',
      record: {
        ...noteRecord(),
        caseId: '51d98f6e-2c45-4a43-9367-28ca36d8b33c' as CaseId,
      },
    },
    { name: 'another actor', record: { ...noteRecord(), actorId: 'another-user' } },
  ])('rejects activity id reuse by $name', async ({ record }) => {
    const { service } = serviceFixture(record)

    await expect(
      service.createNote(caseId, { activityId, content: 'Follow up tomorrow.' }, executionContext),
    ).rejects.toThrow(ActivityIdConflictError)
  })

  it('checks case visibility before resolving an activity id replay', async () => {
    const { casesReadPort, service } = serviceFixture(noteRecord())
    vi.mocked(casesReadPort.findById).mockResolvedValue(null)

    await expect(
      service.createNote(caseId, { activityId, content: 'Follow up tomorrow.' }, executionContext),
    ).rejects.toThrow(ActivityCaseNotFoundError)
  })

  it('rejects invalid direct input and malformed cursors', async () => {
    const { execute, service } = serviceFixture(null)

    await expect(
      service.createNote(caseId, { activityId, content: '   ' }, executionContext),
    ).rejects.toThrow(ActivityValidationError)
    expect(execute).not.toHaveBeenCalled()

    await expect(service.list(caseId, { cursor: 'invalid' }, executionContext)).rejects.toThrow(
      InvalidActivityCursorError,
    )
  })
})

function serviceFixture(existing: ActivityRecord | null) {
  const findOne = vi.fn().mockResolvedValue(existing)
  const find = vi.fn().mockResolvedValue([])
  const create = vi.fn((_entity, value) => value)
  const flush = vi.fn().mockResolvedValue(undefined)
  const persist = vi.fn()
  const entityManager = { create, find, findOne, flush, persist } as unknown as EntityManager
  const execute = vi.fn(async (_operation, executionContext, input, handler) =>
    handler(input, {
      emit: vi.fn(),
      entityManager,
      executionContext,
    }),
  )
  const casesReadPort = {
    findById: vi.fn().mockResolvedValue({ id: caseId, organizationId }),
  } as unknown as CasesReadPort
  return {
    casesReadPort,
    create,
    execute,
    flush,
    persist,
    service: createActivitiesService({
      casesReadPort,
      entityManager,
      operationExecutor: { execute } as unknown as OperationExecutor,
    }),
  }
}

function noteRecord(): ActivityRecord {
  return {
    actorId: 'test-user',
    actorType: 'user',
    body: 'Follow up tomorrow.',
    caseId,
    caseVersion: null,
    fromStatus: null,
    id: activityId,
    occurredAt: new Date('2026-08-28T10:00:00.000Z'),
    organizationId,
    toStatus: null,
    type: 'note',
  }
}

const executionContext: ExecutionContext = {
  actor: { id: 'test-user', type: 'user' },
  capabilities: new Set(['activities.create-note', 'activities.read', 'cases.read']),
  correlationId: 'correlation-id',
  organizationId,
  requestId: 'request-id',
}
