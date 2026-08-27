import { resolveTestDatabaseEnvironment } from './test-database.mjs'

export const E2E_PORT = 3100
export const E2E_ORGANIZATION_ID = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb'

const E2E_DATABASE_URL = 'E2E_DATABASE_URL'
const E2E_RUNTIME_DATABASE_URL = 'E2E_RUNTIME_DATABASE_URL'

export function prepareE2EServerEnvironment(environment) {
  const { testDatabaseUrl } = resolveTestDatabaseEnvironment(environment)
  const targetDatabaseUrl = testDatabaseUrl.href
  const serverEnvironment = stringEnvironment(environment)
  const runtimeDatabaseUrl = environment.DATABASE_URL?.trim()

  serverEnvironment.DATABASE_URL = targetDatabaseUrl
  serverEnvironment.TEST_DATABASE_URL = targetDatabaseUrl
  serverEnvironment[E2E_DATABASE_URL] = targetDatabaseUrl
  serverEnvironment.NODE_ENV = 'test'
  serverEnvironment.ORGANIZATION_ID = E2E_ORGANIZATION_ID
  serverEnvironment.PORT = String(E2E_PORT)

  if (runtimeDatabaseUrl) {
    serverEnvironment[E2E_RUNTIME_DATABASE_URL] = runtimeDatabaseUrl
  } else {
    delete serverEnvironment[E2E_RUNTIME_DATABASE_URL]
  }

  return serverEnvironment
}

export function resolveE2EServerEnvironment(environment) {
  const preparedTarget = environment[E2E_DATABASE_URL]?.trim()

  if (!preparedTarget) return prepareE2EServerEnvironment(environment)

  const { testDatabaseUrl } = resolveTestDatabaseEnvironment({
    DATABASE_URL: environment[E2E_RUNTIME_DATABASE_URL],
    TEST_DATABASE_URL: preparedTarget,
  })
  const targetDatabaseUrl = testDatabaseUrl.href

  if (environment.DATABASE_URL?.trim() !== targetDatabaseUrl) {
    throw new Error('Prepared E2E DATABASE_URL does not match the dedicated test database.')
  }

  return prepareE2EServerEnvironment({
    ...environment,
    DATABASE_URL: environment[E2E_RUNTIME_DATABASE_URL],
    TEST_DATABASE_URL: targetDatabaseUrl,
  })
}

function stringEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter((entry) => typeof entry[1] === 'string'),
  )
}
