import { asFunction } from 'awilix'

import { defineModule } from '../module.js'
import { CaseEntity } from './case.entity.js'
import { casesCapabilities } from './cases.capabilities.js'
import { casesEvents } from './cases.events.js'
import { casesOperations } from './cases.operations.js'
import { createCasesRoutes } from './cases.routes.js'
import { createCasesService } from './cases.service.js'

export const casesModule = defineModule({
  capabilities: casesCapabilities,
  dependencies: [],
  entities: [CaseEntity],
  events: { publishes: casesEvents, subscribes: [] },
  extensions: { contributes: [], provides: [] },
  id: 'cases',
  operations: casesOperations,
  registrations: {
    casesService: asFunction(createCasesService).scoped(),
  },
  routes: createCasesRoutes,
})
