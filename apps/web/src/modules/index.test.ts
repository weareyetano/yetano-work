import { describe, expect, it } from 'vitest'

import { defaultWebModule, isWebModuleActive, webModules } from './index'

describe('web module registry', () => {
  it('has unique identifiers and paths and contains its available default module', () => {
    const ids = webModules.map((module) => module.id)
    const paths = webModules.flatMap((module) =>
      module.availability === 'available' ? [module.path] : [],
    )

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(paths).size).toBe(paths.length)
    expect(defaultWebModule.availability).toBe('available')
    expect(webModules).toContain(defaultWebModule)
  })

  it('matches exact and nested module paths without matching sibling prefixes', () => {
    expect(isWebModuleActive(defaultWebModule, '/cases')).toBe(true)
    expect(isWebModuleActive(defaultWebModule, '/cases/123')).toBe(true)
    expect(isWebModuleActive(defaultWebModule, '/cases-archive')).toBe(false)
    expect(isWebModuleActive(defaultWebModule, '/settings')).toBe(false)
    expect(isWebModuleActive(webModules[1], '/tasks')).toBe(false)
  })
})
