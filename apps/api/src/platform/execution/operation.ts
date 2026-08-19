import type { EntityManager } from '@mikro-orm/postgresql'

import type { ModuleCatalog } from '../../modules/catalog.js'
import type { EventDefinition } from '../../modules/module.js'
import type { OutboxWriter, PendingDomainEvent } from '../events/outbox.js'
import type { ExecutionContext } from './context.js'
import { AuthorizationDeniedError } from './errors.js'

export interface OperationDefinition<Input, Output> {
  capability: string | null
  id: string
  kind: 'command' | 'query'
  readonly _input?: Input
  readonly _output?: Output
}

export interface OperationRunContext {
  emit<Definition extends EventDefinition>(event: PendingDomainEvent<Definition>): void
  entityManager: EntityManager
  executionContext: ExecutionContext
}

export interface OperationExecutor {
  execute<Input, Output>(
    operation: OperationDefinition<Input, Output>,
    executionContext: ExecutionContext,
    input: Input,
    handler: (input: Input, context: OperationRunContext) => Promise<Output>,
  ): Promise<Output>
}

export function defineOperation<Input, Output>(
  definition: Omit<OperationDefinition<Input, Output>, '_input' | '_output'>,
): OperationDefinition<Input, Output> {
  return definition
}

export function createOperationExecutor({
  entityManager,
  moduleCatalog,
  outboxWriter,
}: {
  entityManager: EntityManager
  moduleCatalog: ModuleCatalog
  outboxWriter: OutboxWriter
}): OperationExecutor {
  return {
    async execute(operation, executionContext, input, handler) {
      authorize(operation, executionContext, moduleCatalog)

      if (operation.kind === 'query') {
        return handler(input, {
          emit: rejectQueryEvent,
          entityManager,
          executionContext,
        })
      }

      return entityManager.transactional(async (transaction) => {
        const events: PendingDomainEvent[] = []
        const result = await handler(input, {
          emit: (event) => events.push(event),
          entityManager: transaction,
          executionContext,
        })
        await outboxWriter.append(transaction, executionContext, events)
        return result
      })
    },
  }
}

function authorize(
  operation: OperationDefinition<unknown, unknown>,
  executionContext: ExecutionContext,
  moduleCatalog: ModuleCatalog,
) {
  if (!operation.capability) return
  for (const capability of moduleCatalog.requiredCapabilities(operation.capability)) {
    if (!executionContext.capabilities.has(capability)) {
      throw new AuthorizationDeniedError(capability)
    }
  }
}

function rejectQueryEvent(): never {
  throw new Error('Queries cannot emit domain events.')
}
