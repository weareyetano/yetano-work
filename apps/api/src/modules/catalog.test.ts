import { asFunction } from 'awilix'
import { describe, expect, it } from 'vitest'
import { casesModule, caseTransitionedEvent } from './cases/index.js'
import { createModuleCatalog } from './catalog.js'
import { healthModule } from './health/index.js'
import { applicationModuleCatalog, applicationModules } from './index.js'
import { defineSubscription } from './module.js'

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
          registrations: {},
        },
      ]),
    ).toThrow('Module case-admin HTTP path /cases/admin overlaps module cases path /cases')
  })

  it('accepts a subscriber that imports a named event contract and declares its versions', () => {
    expect(() =>
      createModuleCatalog([
        casesModule,
        subscriberModule(
          defineSubscription({
            event: caseTransitionedEvent,
            handlerRegistration: 'caseTransitionedActivityProjector',
            supportedVersions: [3],
          }),
        ),
      ]),
    ).not.toThrow()
  })

  it('fails fast when a subscriber declares an unknown schema version', () => {
    const subscription = defineSubscription({
      event: caseTransitionedEvent,
      handlerRegistration: 'caseTransitionedActivityProjector',
      supportedVersions: [3],
    })

    expect(() =>
      createModuleCatalog([
        casesModule,
        subscriberModule({ ...subscription, supportedVersions: [4] }),
      ]),
    ).toThrow(
      'Subscription activities:case.transitioned references unknown case.transitioned schema version 4',
    )
  })

  it('fails fast when a subscriber omits the current schema version', () => {
    expect(() =>
      createModuleCatalog([
        casesModule,
        subscriberModule(
          defineSubscription({
            event: caseTransitionedEvent,
            handlerRegistration: 'caseTransitionedActivityProjector',
            supportedVersions: [2],
          }),
        ),
      ]),
    ).toThrow(
      'Subscription activities:case.transitioned must support current case.transitioned schema version 3',
    )
  })

  it('requires the subscribing module to declare its publisher dependency', () => {
    const subscription = defineSubscription({
      event: caseTransitionedEvent,
      handlerRegistration: 'caseTransitionedActivityProjector',
      supportedVersions: [3],
    })

    expect(() =>
      createModuleCatalog([casesModule, { ...subscriberModule(subscription), dependencies: [] }]),
    ).toThrow('Module activities must depend on cases to subscribe to case.transitioned')
  })

  it('requires the handler registration to belong to the subscribing module', () => {
    const subscription = defineSubscription({
      event: caseTransitionedEvent,
      handlerRegistration: 'caseTransitionedActivityProjector',
      supportedVersions: [3],
    })

    expect(() =>
      createModuleCatalog([casesModule, { ...subscriberModule(subscription), registrations: {} }]),
    ).toThrow(
      'Subscription activities:case.transitioned handler registration caseTransitionedActivityProjector must belong to module activities',
    )
  })

  it('requires the subscription handler registration to be scoped', () => {
    const subscription = defineSubscription({
      event: caseTransitionedEvent,
      handlerRegistration: 'caseTransitionedActivityProjector',
      supportedVersions: [3],
    })

    expect(() =>
      createModuleCatalog([
        casesModule,
        {
          ...subscriberModule(subscription),
          registrations: {
            caseTransitionedActivityProjector: asFunction(() => ({ handle: async () => {} })),
          },
        },
      ]),
    ).toThrow(
      'Subscription activities:case.transitioned handler registration caseTransitionedActivityProjector must be scoped',
    )
  })
})

function subscriberModule(
  subscription:
    | (typeof casesModule.events.subscribes)[number]
    | ReturnType<typeof defineSubscription>,
) {
  return {
    ...healthModule,
    dependencies: ['cases'],
    events: { publishes: [], subscribes: [subscription] },
    http: { access: 'public' as const, path: '/activities' as const },
    id: 'activities',
    registrations: {
      [subscription.handlerRegistration]: asFunction(() => ({ handle: async () => {} })).scoped(),
    },
  }
}
