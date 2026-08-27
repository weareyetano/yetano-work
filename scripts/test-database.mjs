const DEFAULT_POSTGRES_PORT = '5432'
const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', '::1', '[::1]', 'localhost'])

export function resolveTestDatabaseEnvironment(environment) {
  const runtimeValue = environment.DATABASE_URL?.trim()
  const explicitTestValue = environment.TEST_DATABASE_URL?.trim()
  const runtimeUrl = runtimeValue ? parsePostgresUrl(runtimeValue, 'DATABASE_URL') : null

  if (!explicitTestValue) throw new Error('TEST_DATABASE_URL is required.')

  const testUrl = parsePostgresUrl(explicitTestValue, 'TEST_DATABASE_URL')

  if (runtimeUrl && sameDatabase(runtimeUrl, testUrl)) {
    throw new Error('TEST_DATABASE_URL must point to a different database than DATABASE_URL.')
  }

  return {
    databaseName: databaseName(testUrl),
    testDatabaseUrl: testUrl,
  }
}

export function isLocalDatabaseUrl(url) {
  return LOCAL_DATABASE_HOSTS.has(url.hostname.toLowerCase())
}

function parsePostgresUrl(value, name) {
  let url

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`)
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`${name} must use the postgres or postgresql protocol.`)
  }
  if (!url.hostname || !databaseName(url)) {
    throw new Error(`${name} must include a host and database name.`)
  }

  return url
}

function databaseName(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, ''))
}

function sameDatabase(first, second) {
  return (
    normalizedHost(first) === normalizedHost(second) &&
    (first.port || DEFAULT_POSTGRES_PORT) === (second.port || DEFAULT_POSTGRES_PORT) &&
    databaseName(first) === databaseName(second)
  )
}

function normalizedHost(url) {
  return isLocalDatabaseUrl(url) ? 'local' : url.hostname.toLowerCase()
}
