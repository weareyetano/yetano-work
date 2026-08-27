import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { isLocalDatabaseUrl, resolveTestDatabaseEnvironment } from './test-database.mjs'

export function setupTestDatabase({
  environment = process.env,
  error = console.error,
  log = console.log,
  run = spawnSync,
} = {}) {
  let configuration

  try {
    configuration = resolveTestDatabaseEnvironment(environment)
  } catch (configurationError) {
    error(`Test database setup NOT RUN: ${configurationError.message}`)
    return 2
  }

  const { databaseName, testDatabaseUrl } = configuration

  if (!isLocalDatabaseUrl(testDatabaseUrl)) {
    error('Test database setup NOT RUN: db:test:setup only manages the local Docker database.')
    return 2
  }
  if (testDatabaseUrl.username !== 'yetano') {
    error('Test database setup NOT RUN: the local Docker database user must be yetano.')
    return 2
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) {
    error('Test database setup NOT RUN: the local test database name is not a safe identifier.')
    return 2
  }

  const lookup = run(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'yetano',
      '-d',
      'postgres',
      '-Atqc',
      `select 1 from pg_database where datname = '${databaseName}'`,
    ],
    { encoding: 'utf8' },
  )

  if (lookup.error || lookup.status !== 0) {
    error(`Test database setup FAIL: ${commandFailure(lookup)}`)
    return lookup.status ?? 1
  }
  if (String(lookup.stdout ?? '').trim() === '1') {
    log(`Test database ${databaseName} is ready.`)
    return 0
  }

  const creation = run(
    'docker',
    ['compose', 'exec', '-T', 'db', 'createdb', '-U', 'yetano', databaseName],
    { encoding: 'utf8' },
  )

  if (creation.error || creation.status !== 0) {
    error(`Test database setup FAIL: ${commandFailure(creation)}`)
    return creation.status ?? 1
  }

  log(`Created test database ${databaseName}.`)
  return 0
}

function commandFailure(result) {
  if (result.error) return result.error.message
  return String(result.stderr ?? '').trim() || `docker exited with status ${result.status}`
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = setupTestDatabase()
}
