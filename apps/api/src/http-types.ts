import type { AwilixContainer } from 'awilix'

import type { Cradle } from './container.js'

export interface AppEnvironment {
  Variables: {
    requestId: string
    scope: AwilixContainer<Cradle>
  }
}
