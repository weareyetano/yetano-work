import { createRuntime } from './runtime.js'

const runtime = await createRuntime({ migrationSnapshot: false })

try {
  const migrations = await runtime.orm.migrator.up()
  runtime.logger.info('Database migrations completed', {
    migrations: migrations.map((migration) => migration.name),
  })
} finally {
  await runtime.orm.close(true)
}
