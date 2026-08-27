import { MikroORM } from '@mikro-orm/postgresql'

import { createOrmOptions } from './database.js'

export async function resetE2EDatabase(databaseUrl: string): Promise<void> {
  const orm = await MikroORM.init(createOrmOptions({ databaseUrl }, { migrationSnapshot: false }))

  try {
    await orm.schema.drop({ dropMigrationsTable: true })
    await orm.migrator.up()
  } finally {
    await orm.close(true)
  }
}
