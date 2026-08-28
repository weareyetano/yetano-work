import { describe, expect, it } from 'vitest'
import type { Cradle } from '../container.js'
import { casesModule, caseTransitionedEvent } from './cases/index.js'
import { createModuleCatalog } from './catalog.js'
import { healthModule } from './health/index.js'
import { applicationModuleCatalog, applicationModules } from './index.js'
import { createModuleRegistrationBuilder, defineSubscription } from './module.js'

const registerTest = createModuleRegistrationBuilder<Cradle>()
const emptyRegistrations = { private: {}, public: {} }

describe('module catalog', () => {
  it('exposes the explicit application modules and inherited capability requirements', () => {
    expect(applicationModules.map((module) => module.id)).toEqual(['health', 'cases'])
    expect(applicationModules.map((module) => [module.http.path, module.http.access])).toEqual([
      ['/health', 'public'],
      ['/cases', 'protected'],
    ])
    expect(applicationModuleCatalog.events.get('case.transitioned')).toBe(caseTransitionedEvent)
    expect(applicationModuleCatalog.requiredCapabilities('cases.close')).toEqual([
      'cases.close',
      'cases.read',
    ])
    expect(applicationModuleCatalog.requiredCapabilities('cases.transition')).toEqual([
      'cases.transition',
      'cases.read',
    ])
    expect(applicationModuleCatalog.requiredCapabilities('cases.reopen')).toEqual([
      'cases.reopen',
      'cases.read',
    ])
  })

  it('fails fast when an operation references an undeclared capability', () => {
    expect(() =>
      createModuleCatalog([
        {
          ...casesModule,
          operations: [
            {
              capability: 'cases.delete',
              id: 'cases.delete',
              kind: 'command',
            },
          ],
        },
      ]),
    ).toThrow('Operation cases.delete references unknown capability cases.delete')
  })

  it('fails fast when a contribution references an undeclared extension point', () => {
    expect(() =>
      createModuleCatalog([
        {
          ...casesModule,
          extensions: { contributes: ['customers.sidebar'], provides: [] },
        },
      ]),
    ).toThrow('Module cases contributes to unknown extension point customers.sidebar')
  })

  it('fails fast when modules overwrite the same container registration', () => {
    expect(() =>
      createModuleCatalog([
        casesModule,
        {
          ...casesModule,
          capabilities: [],
          entities: [],
          events: { publishes: [], subscribes: [] },
          http: { access: 'protected', path: '/other-cases' },
          id: 'other-cases',
          operations: [],
          routes: casesModule.routes,
        },
      ]),
    ).toThrow('Duplicate container registration id: casesReadPort')
  })

  it('fails fast when a public module declares protected application behavior', () => {
    expect(() =>
      createModuleCatalog([{ ...casesModule, http: { access: 'public', path: '/public-cases' } }]),
    ).toThrow('Public module cases cannot declare capabilities')
  })

  it('fails fast when a public module operation requires another module capability', () => {
    expect(() =>
      createModuleCatalog([
        casesModule,
        {
          ...healthModule,
          operations: [
            {
              capability: 'cases.read',
              id: 'health.protected-check',
              kind: 'query',
            },
          ],
        },
      ]),
    ).toThrow('Public module health operation health.protected-check cannot require a capability')
  })

  it('fails fast when module HTTP paths overlap', () => {
    expect(() =>
      createModuleCatalog([
        casesModule,
        {
          ...casesModule,
          capabilities: [],
          entities: [],
          events: { publishes: [], subscribes: [] },
          http: { access: 'protected', path: '/cases/admin' },
          id: 'case-admin',
          operations: [],
          registrations: emptyRegistrations,
        },
      ]),
    ).toThrow('Module case-admin HTTP path /cases/admin overlaps module cases path /cases')
  })

  it('accepts a subscriber that imports a named event contract and declares its versions', () => {
    expect(() => createModuleCatalog([casesModule, subscriberModule()])).not.toThrow()
  })

  it('fails fast when a subscriber declares an unknown schema version', () => {
    const subscriber = subscriberModule()
    const [subscription] = subscriber.events.subscribes

    expect(() =>
      createModuleCatalog([
        casesModule,
        {
          ...subscriber,
          events: {
            publishes: [],
            subscribes: [{ ...subscription, supportedVersions: [4] }],
          },
        },
      ]),
    ).toThrow(
      'Subscription activities:case.transitioned references unknown case.transitioned schema version 4',
    )
  })

  it('fails fast when a subscriber omits the current schema version', () => {
    const subscriber = subscriberModule()
    const [subscription] = subscriber.events.subscribes

    expect(() =>
      createModuleCatalog([
        casesModule,
        {
          ...subscriber,
          events: {
            publishes: [],
            subscribes: [{ ...subscription, supportedVersions: [2] }],
          },
        },
      ]),
    ).toThrow(
      'Subscription activities:case.transitioned must support current case.transitioned schema version 3',
    )
  })

  it('requires the subscribing module to declare its publisher dependency', () => {
    expect(() =>
      createModuleCatalog([casesModule, { ...subscriberModule(), dependencies: [] }]),
    ).toThrow('Module activities must depend on cases to subscribe to case.transitioned')
  })

  it('requires the handler registration to belong to the subscribing module', () => {
    expect(() =>
      createModuleCatalog([
        casesModule,
        { ...subscriberModule(), registrations: emptyRegistrations },
      ]),
    ).toThrow(
      'Subscription activities:case.transitioned handler registration caseTransitionedActivityProjector must belong to module activities',
    )
  })

  it('requires the subscription handler registration to be scoped', () => {
    expect(() =>
      createModuleCatalog([casesModule, subscriberModule({ handlerLifetime: 'transient' })]),
    ).toThrow(
      'Subscription activities:case.transitioned handler registration caseTransitionedActivityProjector must be scoped',
    )
  })

  it('accepts a declared public port consumed by a module registration', () => {
    expect(() =>
      createModuleCatalog([casesModule, subscriberModule({ consumeCasesReadPort: true })]),
    ).not.toThrow()
  })

  it('rejects private ports and undeclared public port injection', () => {
    expect(() =>
      createModuleCatalog([
        casesModule,
        {
          ...subscriberModule(),
          dependencies: [{ moduleId: 'cases', ports: ['casesService'] }],
        },
      ]),
    ).toThrow('Module activities imports unknown or private port casesService from cases')

    expect(() =>
      createModuleCatalog([
        casesModule,
        subscriberModule({ injectCasesReadPortWithoutDeclaration: true }),
      ]),
    ).toThrow(
      'Module activities registration caseTransitionedActivityProjector injects undeclared port casesReadPort',
    )
  })
})

function subscriberModule({
  consumeCasesReadPort = false,
  handlerLifetime = 'scoped',
  injectCasesReadPortWithoutDeclaration = false,
}: {
  consumeCasesReadPort?: boolean
  handlerLifetime?: 'scoped' | 'transient'
  injectCasesReadPortWithoutDeclaration?: boolean
} = {}) {
  const injectCasesReadPort = consumeCasesReadPort || injectCasesReadPortWithoutDeclaration
  const handlerFactory = injectCasesReadPort
    ? registerTest[handlerLifetime](['casesReadPort'], ({ casesReadPort }) => ({
        casesReadPort,
        handle: async () => {},
      }))
    : registerTest[handlerLifetime]([], () => ({ handle: async () => {} }))
  const registrations = {
    private: { caseTransitionedActivityProjector: handlerFactory },
    public: {},
  }
  const subscription = defineSubscription(registrations.private, {
    event: caseTransitionedEvent,
    handlerRegistration: 'caseTransitionedActivityProjector',
    supportedVersions: [3],
  })

  return {
    ...healthModule,
    dependencies: [{ moduleId: 'cases', ports: consumeCasesReadPort ? ['casesReadPort'] : [] }],
    events: { publishes: [], subscribes: [subscription] },
    http: { access: 'public' as const, path: '/activities' as const },
    id: 'activities',
    registrations,
  }
}
