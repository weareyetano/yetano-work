import type { AvailableWebModuleDefinition } from '../web-module'

const casesWebModule = {
  availability: 'available',
  id: 'cases',
  label: 'Sprawy',
  path: '/cases',
} as const satisfies AvailableWebModuleDefinition

export { casesWebModule }
