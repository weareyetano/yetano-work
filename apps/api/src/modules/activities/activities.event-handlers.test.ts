import type { EntityManager } from '@mikro-orm/postgresql'
import type { CaseId, OrganizationId } from '@yetano/contracts'
import { describe, expect, it, vi } from 'vitest'
import {
  createCaseCreatedActivityHandler,
  createCaseTransitionedActivityHandler,
} from './activities.event-handlers.js'
import { ActivityEntity } from './activity.entity.js'

const caseId = '122c8615-6bcd-4a36-90e6-d18ca0c06928' as CaseId
const organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb' as OrganizationId

describe('activity event handlers', () => {
  it('projects trusted case creation metadata', async () => {
    const { create, entityManager, flush, persist } = entityManagerMock()
    const handler = createCaseCreatedActivityHandler({ entityManager })

    await handler.handle(
      {
        aggregateId: caseId,
        aggregateVersion: 1,
        payload: { caseId, caseVersion: 1 },
        schemaVersion: 1,
        type: 'case.created',
      },
      context,
    )

    expect(create).toHaveBeenCalledWith(ActivityEntity, {
      actorId: 'test-user',
      actorType: 'user',
      body: null,
      caseId,
      caseVersion: 1,
      fromStatus: null,
      id: context.eventId,
      occurredAt: context.occurredAt,
      organizationId,
      toStatus: null,
      type: 'case_created',
    })
    expect(persist).toHaveBeenCalled()
    expect(flush).toHaveBeenCalled()
  })

  it.each([
    { note: null, schemaVersion: 1 as const },
    { note: null, schemaVersion: 2 as const },
    { note: 'Waiting for the customer.', schemaVersion: 3 as const },
  ])('maps case.transitioned v$schemaVersion', async ({ note, schemaVersion }) => {
    const { create, entityManager } = entityManagerMock()
    const handler = createCaseTransitionedActivityHandler({ entityManager })
    const event =
      schemaVersion === 3
        ? {
            aggregateId: caseId,
            aggregateVersion: 2,
            payload: {
              caseId,
              caseVersion: 2,
              fromStatus: 'working' as const,
              note,
              statusChangeId: '85de98ca-c85d-481d-b080-dbef67e94f46',
              toStatus: 'waiting' as const,
              transitionId: 'a64df03a-b392-4288-917b-45b04e578655',
            },
            schemaVersion,
            type: 'case.transitioned' as const,
          }
        : {
            aggregateId: caseId,
            aggregateVersion: 2,
            payload: {
              caseId,
              caseVersion: 2,
              fromStatus: 'working' as const,
              toStatus: 'waiting' as const,
              transitionId: 'a64df03a-b392-4288-917b-45b04e578655',
            },
            schemaVersion,
            type: 'case.transitioned' as const,
          }

    await handler.handle(event, context)

    expect(create).toHaveBeenCalledWith(
      ActivityEntity,
      expect.objectContaining({ body: note, fromStatus: 'working', toStatus: 'waiting' }),
    )
  })
})

function entityManagerMock() {
  const create = vi.fn((_entity, value) => value)
  const flush = vi.fn().mockResolvedValue(undefined)
  const persist = vi.fn()
  return {
    create,
    entityManager: { create, flush, persist } as unknown as EntityManager,
    flush,
    persist,
  }
}

const context = {
  actor: { id: 'test-user', type: 'user' as const },
  correlationId: 'correlation-id',
  eventId: '75bb9ef0-b103-4df7-89ce-efcbd2f79728',
  occurredAt: new Date('2026-08-28T10:00:00.000Z'),
  organizationId,
}
