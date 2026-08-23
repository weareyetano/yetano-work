import { describe, expect, it } from 'vitest'
import { casesModule } from './cases/index.js'
import { createModuleCatalog } from './catalog.js'
import { healthModule } from './health/index.js'
import { applicationModuleCatalog, applicationModules } from './index.js'

describe('module catalog', () => {
  it('exposes the explicit application modules and inherited capability requirements', () => {
    expect(applicationModules.map((module) => module.id)).toEqual(['health', 'cases'])
    expect(applicationModules.map((module) => [module.http.path, module.http.access])).toEqual([
      ['/health', 'public'],
      ['/cases', 'protected'],
    ])
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
    ).toThrow('Duplicate container registration id: casesService')
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
})
