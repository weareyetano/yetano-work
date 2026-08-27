import { MikroORM } from '@mikro-orm/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createOrmOptions } from './database.js'

const databaseUrl = process.env.TEST_DATABASE_URL
const describeWithDatabase = databaseUrl ? describe : describe.skip

describeWithDatabase('database migrations', () => {
  let orm: Awaited<ReturnType<typeof MikroORM.init>>

  beforeAll(async () => {
    orm = await MikroORM.init(
      createOrmOptions({ databaseUrl: databaseUrl as string }, { migrationSnapshot: false }),
    )
    await orm.migrator.up()
  })

  afterAll(async () => {
    await orm?.close(true)
  })

  it('reverts and reapplies the application schema', async () => {
    await orm.migrator.down({ to: 0 })

    try {
      await expect(tableNames(orm)).resolves.toEqual({
        cases: null,
        history: null,
        inbox: null,
        outbox: null,
      })
    } finally {
      await orm.migrator.up()
    }

    await expect(tableNames(orm)).resolves.toEqual({
      cases: 'cases',
      history: 'case_status_changes',
      inbox: 'platform_event_inbox',
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
        'truncate table case_status_changes, cases, platform_event_inbox, platform_outbox_events restart identity',
      )
    }
  })

  it('refuses to remove postponed support while postponed data exists', async () => {
    await orm.migrator.down({ to: 'Migration20260821180000' })
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
      await orm.migrator.up()
    }
  })

  it('enforces organization-scoped case history and unique runtime versions', async () => {
    const connection = orm.em.getConnection()
    const caseId = '44444444-4444-4444-8444-444444444444'
    const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const otherOrganizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

    await connection.execute(`insert into cases (
      id, closed_at, created_at, customer_id, description, organization_id, status, status_note,
      title, updated_at, version
    ) values (
      '${caseId}', null, now(), null, null, '${organizationId}', 'new', null,
      'Organization constraint', now(), 1
    )`)

    try {
      await expect(
        connection.execute(`insert into case_status_changes (
          id, actor_id, actor_type, case_id, case_version, changed_at, expected_version,
          from_status, note, organization_id, source, to_status, transition_id, type
        ) values (
          '55555555-5555-4555-8555-555555555555', 'migration', 'system', '${caseId}', 1, now(), null,
          null, null, '${otherOrganizationId}', 'migration', 'new', null, 'created'
        )`),
      ).rejects.toThrow()

      await connection.execute(`insert into case_status_changes (
        id, actor_id, actor_type, case_id, case_version, changed_at, expected_version,
        from_status, note, organization_id, source, to_status, transition_id, type
      ) values (
        '66666666-6666-4666-8666-666666666666', 'system', 'system', '${caseId}', 1, now(), null,
        null, null, '${organizationId}', 'runtime', 'new', null, 'created'
      )`)

      await expect(
        connection.execute(`insert into case_status_changes (
          id, actor_id, actor_type, case_id, case_version, changed_at, expected_version,
          from_status, note, organization_id, source, to_status, transition_id, type
        ) values (
          '77777777-7777-4777-8777-777777777777', 'system', 'system', '${caseId}', 1, now(), null,
          null, null, '${organizationId}', 'runtime', 'new', null, 'created'
        )`),
      ).rejects.toThrow()
    } finally {
      await connection.execute(`delete from case_status_changes where case_id = '${caseId}'`)
      await connection.execute(`delete from cases where id = '${caseId}'`)
    }
  })

  it('rejects ambiguous organization data before adding history constraints', async () => {
    const connection = orm.em.getConnection()
    const caseId = '88888888-8888-4888-8888-888888888888'
    const organizationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const otherOrganizationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

    await orm.migrator.down({ to: 'Migration20260823190000' })
    await connection.execute(`insert into cases (
      id, closed_at, created_at, customer_id, description, organization_id, status, status_note,
      title, updated_at, version
    ) values (
      '${caseId}', null, now(), null, null, '${organizationId}', 'new', null,
      'Migration preflight', now(), 1
    )`)
    await connection.execute(`insert into case_status_changes (
      id, actor_id, actor_type, case_id, case_version, changed_at, expected_version,
      from_status, note, organization_id, source, to_status, transition_id, type
    ) values (
      '99999999-9999-4999-8999-999999999999', 'migration', 'system', '${caseId}', 1, now(), null,
      null, null, '${otherOrganizationId}', 'migration', 'new', null, 'created'
    )`)

    try {
      await expect(orm.migrator.up()).rejects.toThrow(
        'Cannot enforce organization-scoped case history: existing history belongs to a different organization than its case.',
      )
    } finally {
      await connection.execute(`delete from case_status_changes where case_id = '${caseId}'`)
      await connection.execute(`delete from cases where id = '${caseId}'`)
      await orm.migrator.up()
    }
  })
})

async function tableNames(orm: Awaited<ReturnType<typeof MikroORM.init>>) {
  const [row] = await orm.em.getConnection().execute<
    Array<{
      cases: string | null
      history: string | null
      inbox: string | null
      outbox: string | null
    }>
  >(
    `select
       to_regclass('public.cases')::text as cases,
       to_regclass('public.case_status_changes')::text as history,
       to_regclass('public.platform_event_inbox')::text as inbox,
       to_regclass('public.platform_outbox_events')::text as outbox`,
  )
  return row
}
