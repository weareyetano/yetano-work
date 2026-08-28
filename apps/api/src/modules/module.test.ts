import { asValue, createContainer } from 'awilix'
import { describe, expect, it } from 'vitest'

import { createModuleRegistrationBuilder, createModuleResolver } from './module.js'

describe('module dependency injection helpers', () => {
  it('passes only declared dependencies to a module factory', () => {
    interface TestCradle {
      allowed: string
      hidden: string
      service: { dependencies: string[] }
    }
    const register = createModuleRegistrationBuilder<TestCradle>()
    const registrations = {
      private: {
        service: register.scoped(['allowed'], (dependencies) => ({
          dependencies: Object.keys(dependencies),
        })),
      },
      public: {},
    }
    const container = createContainer<TestCradle>()
    container.register({
      allowed: asValue('available'),
      hidden: asValue('private'),
      service: registrations.private.service,
    })

    expect(createModuleResolver(registrations)(container, 'service')).toEqual({
      dependencies: ['allowed'],
    })
  })
})
