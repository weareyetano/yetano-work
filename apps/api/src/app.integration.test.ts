import { MikroORM } from '@mikro-orm/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from './app.js'
import type { AppConfig } from './config.js'
import { createRootContainer } from './container.js'
import { createOrmOptions } from './database.js'
import type { Logger } from './logger.js'

const databaseUrl = process.env.TEST_DATABASE_URL
const describeWithDatabase = databaseUrl ? describe : describe.skip

describeWithDatabase('API with PostgreSQL', () => {
  let orm: Awaited<ReturnType<typeof MikroORM.init>>

  beforeAll(async () => {
    orm = await MikroORM.init(createOrmOptions({ databaseUrl: databaseUrl as string }))
  })

  afterAll(async () => {
    await orm?.close(true)
  })

  it('returns readiness and typed API health', async () => {
    const config: AppConfig = {
      appVersion: 'test',
      databaseUrl: databaseUrl as string,
      logLevel: 'error',
      nodeEnv: 'test',
      port: 3000,
      staticRoot: '/tmp/yetano-work-missing-static',
    }
    const logger: Logger = {
      child: () => logger,
      debug: () => undefined,
      error: () => undefined,
      info: () => undefined,
      warn: () => undefined,
    }
    const container = createRootContainer({ config, logger, orm })
    const app = createApp({ container })

    const readiness = await app.request('/health/ready')
    const health = await app.request('/api/v1/health')

    expect(readiness.status).toBe(200)
    expect(health.status).toBe(200)
    await expect(health.json()).resolves.toEqual({
      database: 'up',
      status: 'ok',
      version: 'test',
    })
  })
})
