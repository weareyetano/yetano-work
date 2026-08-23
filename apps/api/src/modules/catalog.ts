import { Lifetime } from 'awilix'

import {
  type CapabilityDefinition,
  type EventDefinition,
  eventSubscriptionId,
  type ModuleDefinition,
} from './module.js'

export interface ModuleCatalog {
  capabilities: ReadonlyMap<string, CapabilityDefinition>
  events: ReadonlyMap<string, EventDefinition>
  modules: readonly ModuleDefinition[]
  requiredCapabilities(capabilityId: string): readonly string[]
}

interface PublishedEventRegistration {
  definition: EventDefinition
  moduleId: string
}

export function createModuleCatalog(modules: readonly ModuleDefinition[]): ModuleCatalog {
  const moduleIds = new Set<string>()
  const capabilities = new Map<string, CapabilityDefinition>()
  const events = new Map<string, PublishedEventRegistration>()
  const operations = new Set<string>()
  const extensionPoints = new Set<string>()
  const httpPaths = new Map<string, string>()
  const registrations = new Set<string>()
  const subscriptions = new Set<string>()

  for (const module of modules) {
    assertUnique(moduleIds, module.id, 'module')
    assertHttpDefinition(module, httpPaths)
    for (const capability of module.capabilities) {
      assertUnique(capabilities, capability.id, 'capability', capability)
    }
    for (const event of module.events.publishes) {
      assertUnique(events, event.id, 'event', { definition: event, moduleId: module.id })
      assertEventDefinition(event)
    }
    for (const operation of module.operations) assertUnique(operations, operation.id, 'operation')
    for (const registration of Object.keys(module.registrations)) {
      assertUnique(registrations, registration, 'container registration')
    }
    for (const point of module.extensions.provides) {
      assertUnique(extensionPoints, point, 'extension point')
    }
  }

  for (const module of modules) {
    for (const dependency of module.dependencies) {
      if (!moduleIds.has(dependency)) {
        throw new Error(`Module ${module.id} depends on unknown module ${dependency}`)
      }
    }
    for (const capability of module.capabilities) {
      for (const requirement of capability.requires ?? []) {
        if (!capabilities.has(requirement)) {
          throw new Error(`Capability ${capability.id} requires unknown capability ${requirement}`)
        }
      }
    }
    for (const operation of module.operations) {
      if (operation.capability && !capabilities.has(operation.capability)) {
        throw new Error(
          `Operation ${operation.id} references unknown capability ${operation.capability}`,
        )
      }
    }
    for (const contribution of module.extensions.contributes) {
      if (!extensionPoints.has(contribution)) {
        throw new Error(
          `Module ${module.id} contributes to unknown extension point ${contribution}`,
        )
      }
    }
    for (const subscription of module.events.subscribes) {
      const subscriptionId = eventSubscriptionId(module.id, subscription.event.id)
      const handlerRegistration = module.registrations[subscription.handlerRegistration]
      if (!handlerRegistration) {
        throw new Error(
          `Subscription ${subscriptionId} handler registration ${subscription.handlerRegistration} must belong to module ${module.id}`,
        )
      }
      if (handlerRegistration.lifetime !== Lifetime.SCOPED) {
        throw new Error(
          `Subscription ${subscriptionId} handler registration ${subscription.handlerRegistration} must be scoped`,
        )
      }
      const published = events.get(subscription.event.id)
      if (!published) {
        throw new Error(`Module ${module.id} subscribes to unknown event ${subscription.event.id}`)
      }
      const event = published.definition
      if (event !== subscription.event) {
        throw new Error(
          `Module ${module.id} must subscribe through the published ${subscription.event.id} contract`,
        )
      }
      if (published.moduleId !== module.id && !module.dependencies.includes(published.moduleId)) {
        throw new Error(
          `Module ${module.id} must depend on ${published.moduleId} to subscribe to ${event.id}`,
        )
      }
      assertUnique(subscriptions, subscriptionId, 'event subscription')
      if (subscription.supportedVersions.length === 0) {
        throw new Error(`Subscription ${subscriptionId} must support at least one schema version`)
      }
      const supportedVersions = new Set<number>()
      for (const version of subscription.supportedVersions) {
        assertUnique(supportedVersions, version, `schema version in subscription ${subscriptionId}`)
        if (!event.versions.some((definition) => definition.schemaVersion === version)) {
          throw new Error(
            `Subscription ${subscriptionId} references unknown ${event.id} schema version ${version}`,
          )
        }
      }
      if (!subscription.supportedVersions.includes(event.schemaVersion as never)) {
        throw new Error(
          `Subscription ${subscriptionId} must support current ${event.id} schema version ${event.schemaVersion}`,
        )
      }
    }
  }

  assertAcyclic(modules)

  return {
    capabilities,
    events: new Map(
      [...events].map(([eventId, registration]) => [eventId, registration.definition]),
    ),
    modules,
    requiredCapabilities(capabilityId) {
      const resolved = new Set<string>()
      const visit = (id: string) => {
        if (resolved.has(id)) return
        const capability = capabilities.get(id)
        if (!capability) throw new Error(`Unknown capability ${id}`)
        resolved.add(id)
        for (const requirement of capability.requires ?? []) visit(requirement)
      }
      visit(capabilityId)
      return [...resolved]
    },
  }
}

function assertEventDefinition(event: EventDefinition) {
  if (event.versions.length === 0)
    throw new Error(`Event ${event.id} must declare a schema version`)
  const versions = new Set<number>()
  for (const version of event.versions) {
    if (!Number.isSafeInteger(version.schemaVersion) || version.schemaVersion < 1) {
      throw new Error(`Event ${event.id} schema versions must be positive integers`)
    }
    assertUnique(versions, version.schemaVersion, `schema version in event ${event.id}`)
  }
  if (!versions.has(event.schemaVersion)) {
    throw new Error(
      `Event ${event.id} current schema version ${event.schemaVersion} is not declared`,
    )
  }
}

function assertAcyclic(modules: readonly ModuleDefinition[]) {
  const byId = new Map(modules.map((module) => [module.id, module]))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (moduleId: string) => {
    if (visiting.has(moduleId)) throw new Error(`Cyclic module dependency involving ${moduleId}`)
    if (visited.has(moduleId)) return
    visiting.add(moduleId)
    for (const dependency of byId.get(moduleId)?.dependencies ?? []) visit(dependency)
    visiting.delete(moduleId)
    visited.add(moduleId)
  }

  for (const module of modules) visit(module.id)
}

function assertHttpDefinition(module: ModuleDefinition, paths: Map<string, string>) {
  if (!/^\/[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(module.http.path)) {
    throw new Error(`Module ${module.id} has invalid HTTP path ${module.http.path}`)
  }
  for (const [path, moduleId] of paths) {
    if (
      path === module.http.path ||
      path.startsWith(`${module.http.path}/`) ||
      module.http.path.startsWith(`${path}/`)
    ) {
      throw new Error(
        `Module ${module.id} HTTP path ${module.http.path} overlaps module ${moduleId} path ${path}`,
      )
    }
  }
  paths.set(module.http.path, module.id)

  if (module.http.access !== 'public') return
  if (module.capabilities.length > 0) {
    throw new Error(`Public module ${module.id} cannot declare capabilities`)
  }
  const protectedOperation = module.operations.find((operation) => operation.capability !== null)
  if (protectedOperation) {
    throw new Error(
      `Public module ${module.id} operation ${protectedOperation.id} cannot require a capability`,
    )
  }
}

function assertUnique<Id>(
  collection: Set<Id> | Map<Id, unknown>,
  id: Id,
  kind: string,
  value: unknown = true,
) {
  if (collection.has(id)) throw new Error(`Duplicate ${kind} id: ${id}`)
  if (collection instanceof Map) collection.set(id, value)
  else collection.add(id)
}
