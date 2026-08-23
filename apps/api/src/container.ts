import type { EntityManager, MikroORM } from '@mikro-orm/postgresql'
import { type AwilixContainer, asFunction, asValue, createContainer, InjectionMode } from 'awilix'

import type { AppConfig } from './config.js'
import type { Logger } from './logger.js'
import type { CasesReadPort } from './modules/cases/index.js'
import type { ModuleCatalog } from './modules/catalog.js'
import type { HealthService } from './modules/health/index.js'
import { applicationModuleCatalog, applicationModules } from './modules/index.js'
import { createOutboxDispatcher, type OutboxDispatcher } from './platform/events/dispatcher.js'
import { createOutboxWriter, type OutboxWriter } from './platform/events/outbox.js'
import type {
  ActorResolver,
  CapabilityResolver,
  ExecutionContextFactory,
  OrganizationResolver,
} from './platform/execution/context.js'
import { createOperationExecutor, type OperationExecutor } from './platform/execution/operation.js'
import {
  createDevActorResolver,
  createDevCapabilityResolver,
  createExecutionContextFactory,
  createSingleOrganizationResolver,
} from './platform/execution/resolvers.js'

export interface Cradle {
  actorResolver: ActorResolver
  capabilityResolver: CapabilityResolver
  casesReadPort: CasesReadPort
  casesService: unknown
  config: AppConfig
  entityManager: EntityManager
  executionContextFactory: ExecutionContextFactory
  healthService: HealthService
  logger: Logger
  moduleCatalog: ModuleCatalog
  operationExecutor: OperationExecutor
  organizationResolver: OrganizationResolver
  orm: MikroORM
  outboxDispatcher: OutboxDispatcher
  outboxWriter: OutboxWriter
  rootContainer: AppContainer
}

export type AppContainer = AwilixContainer<Cradle>

interface RootContainerDependencies {
  actorResolver?: ActorResolver
  capabilityResolver?: CapabilityResolver
  config: AppConfig
  logger: Logger
  organizationResolver?: OrganizationResolver
  orm: MikroORM
}

export function createRootContainer({
  actorResolver,
  capabilityResolver,
  config,
  logger,
  organizationResolver,
  orm,
}: RootContainerDependencies): AppContainer {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  })

  container.register({
    actorResolver: asValue(actorResolver ?? createDevActorResolver()),
    capabilityResolver: asValue(
      capabilityResolver ??
        createDevCapabilityResolver(applicationModuleCatalog.capabilities.keys()),
    ),
    config: asValue(config),
    executionContextFactory: asFunction(createExecutionContextFactory).singleton(),
    logger: asValue(logger),
    moduleCatalog: asValue(applicationModuleCatalog),
    operationExecutor: asFunction(createOperationExecutor).scoped(),
    organizationResolver: asValue(
      organizationResolver ?? createSingleOrganizationResolver({ config }),
    ),
    orm: asValue(orm),
    outboxDispatcher: asFunction(createOutboxDispatcher).singleton(),
    outboxWriter: asFunction(createOutboxWriter).singleton(),
    rootContainer: asValue(container),
  })

  for (const module of applicationModules) container.register(module.registrations)

  return container
}

export function createRequestScope(container: AppContainer): AppContainer {
  const scope = container.createScope()
  scope.register({
    entityManager: asValue(container.resolve('orm').em.fork()),
  })
  return scope
}
