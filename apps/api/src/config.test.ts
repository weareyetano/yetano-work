import { describe, expect, it } from 'vitest'

import { loadConfig } from './config.js'

describe('loadConfig', () => {
  it('loads defaults and required database configuration', () => {
    const config = loadConfig({ DATABASE_URL: 'postgresql://postgres:postgres@localhost/yetano' })

    expect(config.databaseUrl).toBe('postgresql://postgres:postgres@localhost/yetano')
    expect(config.logLevel).toBe('info')
    expect(config.port).toBe(3000)
  })

  it('reports invalid ports', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://postgres:postgres@localhost/yetano',
        PORT: '70000',
      }),
    ).toThrow('PORT must be between 1 and 65535')
  })
})
