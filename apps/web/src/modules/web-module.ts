type AvailableWebModuleDefinition = {
  availability: 'available'
  id: string
  label: string
  path: `/${string}`
}

type PlannedWebModuleDefinition = {
  availability: 'planned'
  id: string
  label: string
}

type WebModuleDefinition = AvailableWebModuleDefinition | PlannedWebModuleDefinition

function isWebModuleActive(module: WebModuleDefinition, pathname: string) {
  if (module.availability !== 'available') return false

  return pathname === module.path || pathname.startsWith(`${module.path}/`)
}

export type { AvailableWebModuleDefinition, PlannedWebModuleDefinition, WebModuleDefinition }
export { isWebModuleActive }
