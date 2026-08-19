import type { EntityManager } from '@mikro-orm/postgresql'
import { describe, expect, it, vi } from 'vitest'

import { applicationModuleCatalog } from '../../modules/index.js'
import type { EventDefinition } from '../../modules/module.js'
import type { OutboxWriter } from '../events/outbox.js'
import type { ExecutionContext } from './context.js'
import { AuthorizationDeniedError } from './errors.js'
import { createOperationExecutor, defineOperation } from './operation.js'

const command = defineOperation<string, string>({
  capability: 'cases.create',
  id: 'test.create-case',
  kind: 'command',
})

describe('operation executor', () => {
  it('denies an operation before invoking its handler when capability requirements are missing', async () => {
    const transactional = vi.fn()
    const handler = vi.fn()
    const executor = createOperationExecutor({
      entityManager: { transactional } as unknown as EntityManager,
      moduleCatalog: applicationModuleCatalog,
      outboxWriter: { append: vi.fn() },
    })

    await expect(
      executor.execute(command, executionContext(['cases.read']), 'input', handler),
    ).rejects.toBeInstanceOf(AuthorizationDeniedError)
    expect(handler).not.toHaveBeenCalled()
    expect(transactional).not.toHaveBeenCalled()
  })

  it('writes emitted events with the command result in the same transaction', async () => {
    const transaction = {} as EntityManager
    const append = vi.fn<OutboxWriter['append']>()
    const entityManager = {
      transactional: vi.fn(async (run: (manager: EntityManager) => Promise<string>) =>
        run(transaction),
      ),
    } as unknown as EntityManager
    const executor = createOperationExecutor({
      entityManager,
      moduleCatalog: applicationModuleCatalog,
      outboxWriter: { append },
    })
    const eventDefinition: EventDefinition = {
      description: 'Test event.',
      id: 'test.event',
      payloadSchema: {} as EventDefinition['payloadSchema'],
      schemaVersion: 1,
    }

    const result = await executor.execute(
      command,
      executionContext(['cases.create', 'cases.read']),
      'input',
      async (input, context) => {
        context.emit({
          aggregateId: 'aggregate',
          aggregateVersion: 1,
          definition: eventDefinition,
          payload: { input },
        })
        return 'result'
      },
    )

    expect(result).toBe('result')
    expect(append).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb' }),
      [
        {
          aggregateId: 'aggregate',
          aggregateVersion: 1,
          definition: eventDefinition,
          payload: { input: 'input' },
        },
      ],
    )
  })
})

function executionContext(capabilities: string[]): ExecutionContext {
  return {
    actor: { id: 'test-user', type: 'user' },
    capabilities: new Set(capabilities),
    correlationId: 'correlation-id',
    organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
    requestId: 'request-id',
  }
}
