import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import { startE2EServer } from './start-e2e-server.mjs'

const runtimeDatabaseUrl = 'postgresql://yetano:yetano@localhost:5432/yetano_work'
const testDatabaseUrl = 'postgresql://yetano:yetano@localhost:5432/yetano_work_test'

test('E2E reset and application startup only receive the dedicated database', async () => {
  const child = new EventEmitter()
  child.kill = () => true
  let resetDatabaseUrl
  let invocation

  await startE2EServer({
    environment: {
      DATABASE_URL: runtimeDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
    },
    reset: async (databaseUrl) => {
      resetDatabaseUrl = databaseUrl
    },
    start: (command, args, options) => {
      invocation = { args, command, options }
      queueMicrotask(() => child.emit('exit', 0, null))
      return child
    },
  })

  assert.equal(resetDatabaseUrl, testDatabaseUrl)
  assert.equal(invocation.command, 'pnpm')
  assert.deepEqual(invocation.args, ['start'])
  assert.equal(invocation.options.env.DATABASE_URL, testDatabaseUrl)
  assert.equal(invocation.options.env.TEST_DATABASE_URL, testDatabaseUrl)
  assert.equal(invocation.options.env.PORT, '3100')
  assert.equal(invocation.options.env.E2E_DATABASE_URL, undefined)
  assert.equal(invocation.options.env.E2E_RUNTIME_DATABASE_URL, undefined)
  assert.equal(Object.values(invocation.options.env).includes(runtimeDatabaseUrl), false)
})
