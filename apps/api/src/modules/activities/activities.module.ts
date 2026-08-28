import { caseCreatedEvent, caseTransitionedEvent } from '../cases/index.js'
import { defineModule, defineSubscription, type ModuleDefinition } from '../module.js'
import { activitiesCapabilities } from './activities.capabilities.js'
import { activitiesOperations } from './activities.operations.js'
import { activitiesRegistrations } from './activities.registrations.js'
import { createActivitiesRoutes } from './activities.routes.js'
import { ActivityEntity } from './activity.entity.js'

export const activitiesModule: ModuleDefinition<
  typeof activitiesRegistrations.public,
  typeof activitiesRegistrations.private
> = defineModule({
  capabilities: activitiesCapabilities,
  dependencies: [{ moduleId: 'cases', ports: ['casesReadPort'] }],
  entities: [ActivityEntity],
  events: {
    publishes: [],
    subscribes: [
      defineSubscription(activitiesRegistrations.private, {
        event: caseCreatedEvent,
        handlerRegistration: 'caseCreatedActivityHandler',
        supportedVersions: [1],
      }),
      defineSubscription(activitiesRegistrations.private, {
        event: caseTransitionedEvent,
        handlerRegistration: 'caseTransitionedActivityHandler',
        supportedVersions: [1, 2, 3],
      }),
    ],
  },
  extensions: { contributes: [], provides: [] },
  http: { access: 'protected', path: '/activities' },
  id: 'activities',
  operations: activitiesOperations,
  registrations: activitiesRegistrations,
  routes: createActivitiesRoutes,
})
