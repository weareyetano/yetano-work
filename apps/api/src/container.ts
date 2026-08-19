import type { EntityManager, MikroORM } from '@mikro-orm/postgresql'
import { type AwilixContainer, asFunction, asValue, createContainer, InjectionMode } from 'awilix'

import type { AppConfig } from './config.js'
import type { Logger } from './logger.js'
import { createHealthService, type HealthService } from './modules/health/health.service.js'

export interface Cradle {
  config: AppConfig
  entityManager: EntityManager
  healthService: HealthService
  logger: Logger
  orm: MikroORM
}

export type AppContainer = AwilixContainer<Cradle>

interface RootContainerDependencies {
  config: AppConfig
  logger: Logger
  orm: MikroORM
}

export function createRootContainer({
  config,
  logger,
  orm,
}: RootContainerDependencies): AppContainer {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  })

  container.register({
    config: asValue(config),
    healthService: asFunction(createHealthService).scoped(),
    logger: asValue(logger),
    orm: asValue(orm),
  })

  return container
}

export function createRequestScope(container: AppContainer): AppContainer {
  const scope = container.createScope()
  scope.register({
    entityManager: asValue(container.resolve('orm').em.fork()),
  })
  return scope
}
