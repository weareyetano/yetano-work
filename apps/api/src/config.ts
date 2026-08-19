import { resolve } from 'node:path'

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
  port: number
  staticRoot: string
}

export function loadLocalEnvironment(path = '.env'): void {
  if (process.env.NODE_ENV === 'production') return

  try {
    process.loadEnvFile(path)
  } catch (error) {
    if (!isMissingFileError(error)) throw error
  }
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
    port,
    staticRoot: resolve(environment.STATIC_ROOT ?? '../web/dist'),
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
