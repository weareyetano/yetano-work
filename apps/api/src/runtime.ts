import { MikroORM } from '@mikro-orm/postgresql'

import { loadConfig, loadLocalEnvironment } from './config.js'
import { createRootContainer } from './container.js'
import { createOrmOptions } from './database.js'
import { createLogger } from './logger.js'
import { assertDevelopmentResolversAllowed } from './platform/execution/resolvers.js'

export async function createRuntime({ requireProtectedRuntime = false } = {}) {
  loadLocalEnvironment()
  const config = loadConfig()
  const logger = createLogger(config.logLevel, { service: 'yetano-work' })
  if (requireProtectedRuntime) assertDevelopmentResolversAllowed(config)
  const orm = await MikroORM.init(createOrmOptions(config))
  const container = createRootContainer({ config, logger, orm })

  return { config, container, logger, orm }
}
