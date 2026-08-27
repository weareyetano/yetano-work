import type { AwilixContainer } from 'awilix'

import type { Cradle } from '../container.js'
import {
  createModuleRegistrationBuilder,
  createModuleResolver,
  type ModulePlatformCradle,
} from './module.js'

interface ExampleCradle {
  examplePort: { read(): string }
  exampleService: { execute(): string }
}

const registerExample = createModuleRegistrationBuilder<ModulePlatformCradle & ExampleCradle>()

const exampleRegistrations = {
  private: {
    exampleService: registerExample.scoped(['examplePort'], ({ examplePort }) => ({
      execute: () => examplePort.read(),
    })),
  },
  public: {
    examplePort: registerExample.scoped([], () => ({ read: () => 'example' })),
  },
}

const resolveExampleRegistration = createModuleResolver(exampleRegistrations)

export function assertModuleRegistrationTypes(container: AwilixContainer<Cradle>) {
  resolveExampleRegistration(container, 'exampleService').execute()

  // @ts-expect-error Root infrastructure is not available to module factories.
  registerExample.scoped(['orm'], () => ({ execute: () => 'invalid' }))

  // @ts-expect-error A module-local resolver cannot access another module registration.
  resolveExampleRegistration(container, 'casesService')
}
