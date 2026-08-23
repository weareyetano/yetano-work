import type { EntityManager } from '@mikro-orm/postgresql'
import Type from 'typebox'
import { describe, expect, it, vi } from 'vitest'

import { caseCreatedEvent, caseTransitionedEvent } from '../../modules/cases/index.js'
import { applicationModuleCatalog } from '../../modules/index.js'
import { defineEvent } from '../../modules/module.js'
import type { ExecutionContext } from '../execution/context.js'
import { createOutboxWriter } from './outbox.js'

describe('outbox writer', () => {
  it('rejects an event that is not registered in the module catalog', async () => {
    const definition = defineEvent({
      description: 'Unregistered event.',
      id: 'test.unregistered',
      schemaVersion: 1,
      versions: [{ payloadSchema: Type.Object({ value: Type.String() }), schemaVersion: 1 }],
    })
    const persist = vi.fn()

    await expect(
      writer().append({ persist } as unknown as EntityManager, executionContext, [
        {
          aggregateId: 'aggregate-id',
          aggregateVersion: 1,
          definition,
          payload: { value: 'payload' },
        },
      ]),
    ).rejects.toThrow('Event test.unregistered is not registered in the module catalog')
    expect(persist).not.toHaveBeenCalled()
  })

  it('rejects a different contract object with a registered event id', async () => {
    const persist = vi.fn()

    await expect(
      writer().append({ persist } as unknown as EntityManager, executionContext, [
        {
          aggregateId: 'aggregate-id',
          aggregateVersion: 1,
          definition: { ...caseCreatedEvent },
          payload: {
            caseId: 'c55e3c9b-8144-4928-b09f-89787714c097',
            caseVersion: 1,
          },
        },
      ]),
    ).rejects.toThrow('Event case.created must use the contract registered in the module catalog')
    expect(persist).not.toHaveBeenCalled()
  })

  it('rejects an invalid current payload before persisting any event in the batch', async () => {
    const persist = vi.fn()

    await expect(
      writer().append({ persist } as unknown as EntityManager, executionContext, [
        {
          aggregateId: 'aggregate-id',
          aggregateVersion: 1,
          definition: caseCreatedEvent,
          payload: {
            caseId: 'c55e3c9b-8144-4928-b09f-89787714c097',
            caseVersion: 1,
          },
        },
        {
          aggregateId: 'aggregate-id',
          aggregateVersion: 2,
          definition: caseCreatedEvent,
          payload: {
            caseId: 'c55e3c9b-8144-4928-b09f-89787714c097',
          } as never,
        },
      ]),
    ).rejects.toThrow('Invalid case.created v1 payload')
    expect(persist).not.toHaveBeenCalled()
  })

  it('persists a valid event with occurrence time only in its envelope', async () => {
    const occurredAt = new Date('2026-08-23T10:00:00.000Z')
    const create = vi.fn((_entity, data) => data)
    const persist = vi.fn()
    const flush = vi.fn()
    const entityManager = { create, flush, persist } as unknown as EntityManager

    await writer().append(entityManager, executionContext, [
      {
        aggregateId: 'c55e3c9b-8144-4928-b09f-89787714c097',
        aggregateVersion: 2,
        definition: caseTransitionedEvent,
        occurredAt,
        payload: {
          caseId: 'c55e3c9b-8144-4928-b09f-89787714c097',
          caseVersion: 2,
          fromStatus: 'new',
          note: null,
          statusChangeId: 'bdd62ce9-b6d1-44ea-842d-7d4f4fb5abcc',
          toStatus: 'working',
          transitionId: 'ff92ba4c-d8d3-4afe-85a0-d5dc9762bde7',
        },
      },
    ])

    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        occurredAt,
        payload: expect.not.objectContaining({ occurredAt: expect.anything() }),
        type: 'case.transitioned',
      }),
    )
    expect(flush).toHaveBeenCalledOnce()
  })
})

function writer() {
  return createOutboxWriter({ moduleCatalog: applicationModuleCatalog })
}

const executionContext: ExecutionContext = {
  actor: { id: 'test-user', type: 'user' },
  capabilities: new Set(),
  correlationId: 'correlation-id',
  organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
  requestId: 'request-id',
}
