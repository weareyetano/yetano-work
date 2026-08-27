import type { ModulePlatformCradle } from '../module.js'
import { createModuleRegistrationBuilder, createModuleResolver } from '../module.js'
import { createHealthService, type HealthService } from './health.service.js'

interface HealthModuleCradle {
  healthService: HealthService
}

const registerHealth = createModuleRegistrationBuilder<ModulePlatformCradle & HealthModuleCradle>()

export const healthRegistrations = {
  private: {
    healthService: registerHealth.scoped(
      ['config', 'entityManager', 'logger'],
      createHealthService,
    ),
  },
  public: {},
}

export const resolveHealthRegistration = createModuleResolver(healthRegistrations)
