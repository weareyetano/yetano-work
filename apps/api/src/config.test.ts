import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { loadConfig, loadLocalEnvironment } from './config.js'

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

describe('loadLocalEnvironment', () => {
  it('loads the environment file from the workspace root', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'yetano-config-'))
    const packageDirectory = join(workspace, 'apps', 'api')
    const variable = 'YETANO_ROOT_ENV_TEST'
    const previousNodeEnvironment = process.env.NODE_ENV
    const previousValue = process.env[variable]

    await mkdir(packageDirectory, { recursive: true })
    await writeFile(join(workspace, 'pnpm-workspace.yaml'), 'packages: []\n')
    await writeFile(join(workspace, '.env'), `${variable}=workspace-root\n`)
    await writeFile(join(packageDirectory, '.env'), `${variable}=package-directory\n`)

    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(packageDirectory)

    try {
      process.env.NODE_ENV = 'test'
      delete process.env[variable]

      loadLocalEnvironment()

      expect(process.env[variable]).toBe('workspace-root')
    } finally {
      cwd.mockRestore()
      if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previousNodeEnvironment
      if (previousValue === undefined) delete process.env[variable]
      else process.env[variable] = previousValue
      await rm(workspace, { force: true, recursive: true })
    }
  })
})
