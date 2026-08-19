import { describe, expect, it } from 'vitest'
import { casesModule } from './cases/index.js'
import { createModuleCatalog } from './catalog.js'
import { applicationModuleCatalog, applicationModules } from './index.js'

describe('module catalog', () => {
  it('exposes the explicit application modules and inherited capability requirements', () => {
    expect(applicationModules.map((module) => module.id)).toEqual(['health', 'cases'])
    expect(applicationModuleCatalog.requiredCapabilities('cases.close')).toEqual([
      'cases.close',
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
          id: 'other-cases',
          operations: [],
          routes: casesModule.routes,
        },
      ]),
    ).toThrow('Duplicate container registration id: casesService')
  })
})
