import { asFunction } from 'awilix'

import { defineOperation } from '../../platform/execution/operation.js'
import { defineModule } from '../module.js'
import { createHealthRoutes } from './health.routes.js'
import { createHealthService } from './health.service.js'

const getHealthOperation = defineOperation<undefined, unknown>({
  capability: null,
  id: 'health.get',
  kind: 'query',
})

export const healthModule = defineModule({
  capabilities: [],
  dependencies: [],
  entities: [],
  events: { publishes: [], subscribes: [] },
  extensions: { contributes: [], provides: [] },
  http: { access: 'public', path: '/health' },
  id: 'health',
  operations: [getHealthOperation],
  registrations: {
    healthService: asFunction(createHealthService).scoped(),
  },
  routes: createHealthRoutes,
})
