import { MikroORM } from '@mikro-orm/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createOrmOptions } from '../database.js'

const databaseUrl = process.env.TEST_DATABASE_URL
const describeWithDatabase = databaseUrl ? describe : describe.skip

describeWithDatabase('database migrations', () => {
  let orm: Awaited<ReturnType<typeof MikroORM.init>>

  beforeAll(async () => {
    orm = await MikroORM.init(createOrmOptions({ databaseUrl: databaseUrl as string }))
    await orm.migrator.up()
  })

  afterAll(async () => {
    await orm?.close(true)
  })

  it('reverts and reapplies the application schema', async () => {
    await orm.migrator.down()

    try {
      await expect(tableNames(orm)).resolves.toEqual({ cases: null, outbox: null })
    } finally {
      await orm.migrator.up()
    }

    await expect(tableNames(orm)).resolves.toEqual({
      cases: 'cases',
      outbox: 'platform_outbox_events',
    })
  })
})

async function tableNames(orm: Awaited<ReturnType<typeof MikroORM.init>>) {
  const [row] = await orm.em
    .getConnection()
    .execute<Array<{ cases: string | null; outbox: string | null }>>(
      `select
       to_regclass('public.cases')::text as cases,
       to_regclass('public.platform_outbox_events')::text as outbox`,
    )
  return row
}
