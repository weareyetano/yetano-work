import { activitiesModule } from './activities/index.js'
import { casesModule } from './cases/index.js'
import { createModuleCatalog } from './catalog.js'
import { healthModule } from './health/index.js'

export const applicationModules = [healthModule, casesModule, activitiesModule] as const
export const applicationModuleCatalog = createModuleCatalog(applicationModules)
