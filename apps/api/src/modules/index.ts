import { casesModule } from './cases/index.js'
import { createModuleCatalog } from './catalog.js'
import { healthModule } from './health/index.js'

export const applicationModules = [healthModule, casesModule] as const
export const applicationModuleCatalog = createModuleCatalog(applicationModules)
