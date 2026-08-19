import { MikroORM } from '@mikro-orm/postgresql'

import { loadConfig, loadLocalEnvironment } from './config.js'
import { createRootContainer } from './container.js'
import { createOrmOptions } from './database.js'
import { createLogger } from './logger.js'

export async function createRuntime() {
  loadLocalEnvironment()
  const config = loadConfig()
  const logger = createLogger(config.logLevel, { service: 'yetano-work' })
  const orm = await MikroORM.init(createOrmOptions(config))
  const container = createRootContainer({ config, logger, orm })

  return { config, container, logger, orm }
}
