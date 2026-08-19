import assert from 'node:assert/strict'
import test from 'node:test'

import { runFullVerification } from './verify-full.mjs'

test('full verification fails before running gates without a test database', () => {
  const errors = []
  let gateStarted = false
  const status = runFullVerification({
    environment: {},
    error: (message) => errors.push(message),
    log: () => {},
    run: () => {
      gateStarted = true
      return { status: 0 }
    },
  })

  assert.equal(status, 2)
  assert.deepEqual(errors, ['Full verification NOT RUN: TEST_DATABASE_URL is required.'])
  assert.equal(gateStarted, false)
})

test('full verification runs the CI gates in order', () => {
  const scripts = []
  const status = runFullVerification({
    environment: { TEST_DATABASE_URL: 'postgresql://test' },
    error: () => {},
    log: () => {},
    run: (_command, [script]) => {
      scripts.push(script)
      return { status: 0 }
    },
  })

  assert.equal(status, 0)
  assert.deepEqual(scripts, [
    'lint',
    'agents:check',
    'typecheck',
    'test',
    'test:integration',
    'api:check',
    'modules:check',
    'build',
    'test:e2e',
  ])
})

test('full verification stops after the first failed gate', () => {
  const scripts = []
  const status = runFullVerification({
    environment: { TEST_DATABASE_URL: 'postgresql://test' },
    error: () => {},
    log: () => {},
    run: (_command, [script]) => {
      scripts.push(script)
      return { status: script === 'test:integration' ? 7 : 0 }
    },
  })

  assert.equal(status, 7)
  assert.deepEqual(scripts, ['lint', 'agents:check', 'typecheck', 'test', 'test:integration'])
})
