import type { AwilixContainer } from 'awilix'

import type { ExecutionContext, ExecutionContextFactory } from './platform/execution/context.js'

interface HttpCradle {
  [registration: string]: unknown
  executionContextFactory: ExecutionContextFactory
}

export interface AppEnvironment {
  Variables: {
    executionContext: ExecutionContext
    requestId: string
    scope: AwilixContainer<HttpCradle>
  }
}
