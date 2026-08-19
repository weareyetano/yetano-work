import type { AwilixContainer } from 'awilix'

import type { Cradle } from './container.js'
import type { ExecutionContext } from './platform/execution/context.js'

export interface AppEnvironment {
  Variables: {
    executionContext: ExecutionContext
    requestId: string
    scope: AwilixContainer<Cradle>
  }
}
