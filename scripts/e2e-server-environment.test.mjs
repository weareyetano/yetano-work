import assert from 'node:assert/strict'
import test from 'node:test'

import {
  E2E_ORGANIZATION_ID,
  E2E_PORT,
  prepareE2EServerEnvironment,
  resolveE2EServerEnvironment,
} from './e2e-server-environment.mjs'

const runtimeDatabaseUrl = 'postgresql://yetano:yetano@localhost:5432/yetano_work'
const testDatabaseUrl = 'postgresql://yetano:yetano@localhost:5432/yetano_work_test'

test('E2E server receives the dedicated test database instead of the runtime database', () => {
  const environment = prepareE2EServerEnvironment({
    DATABASE_URL: runtimeDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
  })

  assert.equal(environment.DATABASE_URL, testDatabaseUrl)
  assert.notEqual(environment.DATABASE_URL, runtimeDatabaseUrl)
  assert.equal(environment.TEST_DATABASE_URL, testDatabaseUrl)
  assert.equal(environment.E2E_DATABASE_URL, testDatabaseUrl)
  assert.equal(environment.E2E_RUNTIME_DATABASE_URL, runtimeDatabaseUrl)
  assert.equal(environment.NODE_ENV, 'test')
  assert.equal(environment.ORGANIZATION_ID, E2E_ORGANIZATION_ID)
  assert.equal(environment.PORT, String(E2E_PORT))
})

test('E2E server refuses a prepared environment redirected to the runtime database', () => {
  const environment = prepareE2EServerEnvironment({
    DATABASE_URL: runtimeDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
  })

  assert.throws(
    () => resolveE2EServerEnvironment({ ...environment, DATABASE_URL: runtimeDatabaseUrl }),
    /Prepared E2E DATABASE_URL does not match the dedicated test database/,
  )
})

test('E2E server revalidates the prepared database before reset and startup', () => {
  const environment = prepareE2EServerEnvironment({
    DATABASE_URL: runtimeDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
  })

  assert.deepEqual(resolveE2EServerEnvironment(environment), environment)
})
