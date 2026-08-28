import type { CasesReadPort } from '../cases/index.js'
import type { ModulePlatformCradle } from '../module.js'
import { createModuleRegistrationBuilder, createModuleResolver } from '../module.js'
import {
  createCaseCreatedActivityHandler,
  createCaseTransitionedActivityHandler,
} from './activities.event-handlers.js'
import { type ActivitiesService, createActivitiesService } from './activities.service.js'

interface ActivitiesModuleCradle {
  activitiesService: ActivitiesService
  caseCreatedActivityHandler: ReturnType<typeof createCaseCreatedActivityHandler>
  caseTransitionedActivityHandler: ReturnType<typeof createCaseTransitionedActivityHandler>
  casesReadPort: CasesReadPort
}

const registerActivities = createModuleRegistrationBuilder<
  ModulePlatformCradle & ActivitiesModuleCradle
>()

export const activitiesRegistrations = {
  private: {
    activitiesService: registerActivities.scoped(
      ['casesReadPort', 'entityManager', 'operationExecutor'],
      createActivitiesService,
    ),
    caseCreatedActivityHandler: registerActivities.scoped(
      ['entityManager'],
      createCaseCreatedActivityHandler,
    ),
    caseTransitionedActivityHandler: registerActivities.scoped(
      ['entityManager'],
      createCaseTransitionedActivityHandler,
    ),
  },
  public: {},
}

export const resolveActivitiesRegistration = createModuleResolver(activitiesRegistrations)
