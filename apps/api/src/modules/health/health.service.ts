import type { EntityManager } from '@mikro-orm/postgresql'
import type { HealthResponse } from '@yetano/contracts'

import type { AppConfig } from '../../config.js'
import type { Logger } from '../../logger.js'

export interface HealthService {
  check(): Promise<HealthResponse>
}

interface HealthServiceDependencies {
  config: AppConfig
  entityManager: EntityManager
  logger: Logger
}

export function createHealthService({
  config,
  entityManager,
  logger,
}: HealthServiceDependencies): HealthService {
  return {
    async check() {
      await entityManager.getConnection().execute('select 1')
      logger.debug('Database health check succeeded')

      return {
        database: 'up',
        status: 'ok',
        version: config.appVersion,
      }
    },
  }
}
