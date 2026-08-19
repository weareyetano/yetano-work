import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { OrganizationId } from '@yetano/contracts'
import Type from 'typebox'
import { Compile } from 'typebox/compile'

const RuntimeEnvironmentSchema = Compile(
  Type.Object({
    APP_VERSION: Type.Optional(Type.String({ minLength: 1 })),
    DATABASE_URL: Type.String({ minLength: 1 }),
    LOG_LEVEL: Type.Optional(
      Type.Union([
        Type.Literal('debug'),
        Type.Literal('info'),
        Type.Literal('warn'),
        Type.Literal('error'),
      ]),
    ),
    NODE_ENV: Type.Optional(
      Type.Union([Type.Literal('development'), Type.Literal('production'), Type.Literal('test')]),
    ),
    ORGANIZATION_ID: Type.String({ format: 'uuid' }),
    PORT: Type.Optional(Type.String({ pattern: '^[0-9]+$' })),
    STATIC_ROOT: Type.Optional(Type.String({ minLength: 1 })),
  }),
)

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AppConfig {
  appVersion: string
  databaseUrl: string
  logLevel: LogLevel
  nodeEnv: 'development' | 'production' | 'test'
  organizationId: OrganizationId
  port: number
  staticRoot: string
}

export function loadLocalEnvironment(path?: string): void {
  if (process.env.NODE_ENV === 'production') return

  try {
    process.loadEnvFile(path ?? resolveWorkspaceEnvironmentPath())
  } catch (error) {
    if (!isMissingFileError(error)) throw error
  }
}

export function resolveWorkspaceEnvironmentPath(startDirectory = process.cwd()): string {
  let directory = resolve(startDirectory)

  while (!existsSync(join(directory, 'pnpm-workspace.yaml'))) {
    const parent = dirname(directory)
    if (parent === directory) {
      throw new Error(`Unable to locate pnpm workspace from ${startDirectory}`)
    }
    directory = parent
  }

  return join(directory, '.env')
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  if (!RuntimeEnvironmentSchema.Check(environment)) {
    const errors = RuntimeEnvironmentSchema.Errors(environment)
      .map((error) => `${error.instancePath || '/'} ${error.message}`)
      .join(', ')

    throw new Error(`Invalid runtime environment: ${errors}`)
  }

  const port = Number.parseInt(environment.PORT ?? '3000', 10)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Invalid runtime environment: PORT must be between 1 and 65535')
  }

  return {
    appVersion: environment.APP_VERSION ?? '0.1.0',
    databaseUrl: environment.DATABASE_URL,
    logLevel: environment.LOG_LEVEL ?? 'info',
    nodeEnv: environment.NODE_ENV ?? 'development',
    organizationId: environment.ORGANIZATION_ID as OrganizationId,
    port,
    staticRoot: resolve(environment.STATIC_ROOT ?? '../web/dist'),
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
