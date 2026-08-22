import type { CapabilityDefinition, ModuleDefinition } from './module.js'

export interface ModuleCatalog {
  capabilities: ReadonlyMap<string, CapabilityDefinition>
  modules: readonly ModuleDefinition[]
  requiredCapabilities(capabilityId: string): readonly string[]
}

export function createModuleCatalog(modules: readonly ModuleDefinition[]): ModuleCatalog {
  const moduleIds = new Set<string>()
  const capabilities = new Map<string, CapabilityDefinition>()
  const events = new Set<string>()
  const operations = new Set<string>()
  const extensionPoints = new Set<string>()
  const httpPaths = new Map<string, string>()
  const registrations = new Set<string>()

  for (const module of modules) {
    assertUnique(moduleIds, module.id, 'module')
    assertHttpDefinition(module, httpPaths)
    for (const capability of module.capabilities) {
      assertUnique(capabilities, capability.id, 'capability', capability)
    }
    for (const event of module.events.publishes) assertUnique(events, event.id, 'event')
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
      if (!events.has(subscription.eventId)) {
        throw new Error(
          `Subscription ${subscription.id} references unknown event ${subscription.eventId}`,
        )
      }
    }
  }

  assertAcyclic(modules)

  return {
    capabilities,
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

function assertUnique(
  collection: Set<string> | Map<string, unknown>,
  id: string,
  kind: string,
  value: unknown = true,
) {
  if (collection.has(id)) throw new Error(`Duplicate ${kind} id: ${id}`)
  if (collection instanceof Map) collection.set(id, value)
  else collection.add(id)
}
