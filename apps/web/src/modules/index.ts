import { casesWebModule } from './cases'
import type { WebModuleDefinition } from './web-module'

const webModules = [
  casesWebModule,
  { availability: 'planned', id: 'tasks', label: 'Zadania' },
  { availability: 'planned', id: 'messages', label: 'Wiadomości' },
] as const satisfies readonly WebModuleDefinition[]

const defaultWebModule = casesWebModule

export type { WebModuleDefinition } from './web-module'
export { isWebModuleActive } from './web-module'
export { defaultWebModule, webModules }
