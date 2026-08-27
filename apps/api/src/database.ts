import { resolve } from 'node:path'

import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/postgresql'

import type { AppConfig } from './config.js'
import { applicationModules } from './modules/index.js'
import { InboxEventEntity } from './platform/events/inbox.entity.js'
import { OutboxEventEntity } from './platform/events/outbox.entity.js'

export function createOrmOptions(
  config: Pick<AppConfig, 'databaseUrl'>,
  { migrationSnapshot = true }: { migrationSnapshot?: boolean } = {},
) {
  return defineConfig({
    clientUrl: config.databaseUrl,
    discovery: {
      warnWhenNoEntities: false,
    },
    entities: [
      InboxEventEntity,
      OutboxEventEntity,
      ...applicationModules.flatMap((module) => [...module.entities]),
    ],
    extensions: [Migrator],
    migrations: {
      glob: 'Migration*.{js,ts}',
      path: resolve(import.meta.dirname, 'migrations'),
      pathTs: resolve(import.meta.dirname, 'migrations'),
      snapshot: migrationSnapshot,
      transactional: true,
    },
  })
}
