import { MikroORM } from '@mikro-orm/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createOrmOptions } from './database.js'

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
    await orm.migrator.down({ to: 0 })

    try {
      await expect(tableNames(orm)).resolves.toEqual({ cases: null, history: null, outbox: null })
    } finally {
      await orm.migrator.up()
    }

    await expect(tableNames(orm)).resolves.toEqual({
      cases: 'cases',
      history: 'case_status_changes',
      outbox: 'platform_outbox_events',
    })
  })

  it('maps legacy lifecycle data without publishing historical outbox events', async () => {
    await orm.migrator.down({ to: 'Migration20260819180117' })
    const connection = orm.em.getConnection()
    await connection.execute(`insert into cases (
      id, closed_at, created_at, customer_id, description, organization_id, status, title,
      updated_at, version
    ) values
      ('11111111-1111-4111-8111-111111111111', null, '2026-08-19T10:00:00Z', null, null,
       'ddbdc2cc-bbc9-4426-97bf-d99520983bbb', 'open', 'Legacy open',
       '2026-08-19T10:00:00Z', 1),
      ('22222222-2222-4222-8222-222222222222', '2026-08-19T12:00:00Z',
       '2026-08-19T10:00:00Z', null, null,
       'ddbdc2cc-bbc9-4426-97bf-d99520983bbb', 'closed', 'Legacy closed',
       '2026-08-19T12:00:00Z', 2)`)

    try {
      await orm.migrator.up()
      const cases = await connection.execute<Array<{ status: string; title: string }>>(
        'select title, status from cases order by title',
      )
      const history = await connection.execute<
        Array<{ note: string | null; source: string; to_status: string }>
      >('select source, to_status, note from case_status_changes order by changed_at, to_status')
      const [{ count: outboxCount }] = await connection.execute<Array<{ count: number }>>(
        'select count(*)::int as count from platform_outbox_events',
      )

      expect(cases).toEqual([
        { status: 'resolved', title: 'Legacy closed' },
        { status: 'new', title: 'Legacy open' },
      ])
      expect(history).toHaveLength(3)
      expect(history.every((entry) => entry.source === 'migration')).toBe(true)
      expect(history.some((entry) => entry.to_status === 'resolved')).toBe(true)
      expect(history.every((entry) => entry.note?.includes('Zmigrowano'))).toBe(true)
      expect(outboxCount).toBe(0)
    } finally {
      await connection.execute(
        'truncate table case_status_changes, cases, platform_outbox_events restart identity',
      )
    }
  })

  it('refuses to remove postponed support while postponed data exists', async () => {
    const connection = orm.em.getConnection()
    await connection.execute(`insert into cases (
      id, closed_at, created_at, customer_id, description, organization_id, status, status_note,
      title, updated_at, version
    ) values (
      '33333333-3333-4333-8333-333333333333', null, now(), null, null,
      'ddbdc2cc-bbc9-4426-97bf-d99520983bbb', 'postponed', null,
      'Postponed rollback guard', now(), 1
    )`)

    try {
      await expect(orm.migrator.down()).rejects.toThrow(
        'Cannot roll back case postponement while postponed lifecycle data exists.',
      )
    } finally {
      await connection.execute(
        `delete from cases where id = '33333333-3333-4333-8333-333333333333'`,
      )
    }
  })
})

async function tableNames(orm: Awaited<ReturnType<typeof MikroORM.init>>) {
  const [row] = await orm.em
    .getConnection()
    .execute<Array<{ cases: string | null; history: string | null; outbox: string | null }>>(
      `select
       to_regclass('public.cases')::text as cases,
       to_regclass('public.case_status_changes')::text as history,
       to_regclass('public.platform_outbox_events')::text as outbox`,
    )
  return row
}
