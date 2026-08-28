import type { ModulePlatformCradle } from '../module.js'
import { createModuleRegistrationBuilder, createModuleResolver } from '../module.js'
import { type CasesReadPort, createCasesReadPort } from './cases.read-port.js'
import { type CasesService, createCasesService } from './cases.service.js'

interface CasesModuleCradle {
  casesReadPort: CasesReadPort
  casesService: CasesService
}

const registerCases = createModuleRegistrationBuilder<ModulePlatformCradle & CasesModuleCradle>()

export const casesRegistrations = {
  private: {
    casesService: registerCases.scoped(['entityManager', 'operationExecutor'], createCasesService),
  },
  public: {
    casesReadPort: registerCases.scoped(['entityManager'], createCasesReadPort),
  },
}

export const resolveCasesRegistration = createModuleResolver(casesRegistrations)
