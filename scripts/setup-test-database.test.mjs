import assert from 'node:assert/strict'
import test from 'node:test'

import { setupTestDatabase } from './setup-test-database.mjs'

const localEnvironment = {
  DATABASE_URL: 'postgresql://yetano:test@localhost:5432/yetano_work',
  TEST_DATABASE_URL: 'postgresql://yetano:test@localhost:5432/yetano_work_test',
}

test('test database setup leaves an existing database unchanged', () => {
  const commands = []
  const messages = []
  const status = setupTestDatabase({
    environment: { ...localEnvironment },
    error: () => {},
    log: (message) => messages.push(message),
    run: (command, args) => {
      commands.push([command, args])
      return { status: 0, stdout: '1\n' }
    },
  })

  assert.equal(status, 0)
  assert.equal(commands.length, 1)
  assert.equal(commands[0][0], 'docker')
  assert.deepEqual(commands[0][1].slice(0, 4), ['compose', 'exec', '-T', 'db'])
  assert.deepEqual(messages, ['Test database yetano_work_test is ready.'])
})

test('test database setup creates a missing database once', () => {
  const commands = []
  const status = setupTestDatabase({
    environment: { ...localEnvironment },
    error: () => {},
    log: () => {},
    run: (command, args) => {
      commands.push([command, args])
      return commands.length === 1 ? { status: 0, stdout: '' } : { status: 0, stdout: '' }
    },
  })

  assert.equal(status, 0)
  assert.equal(commands.length, 2)
  assert.deepEqual(commands[1], [
    'docker',
    ['compose', 'exec', '-T', 'db', 'createdb', '-U', 'yetano', 'yetano_work_test'],
  ])
})

test('test database setup requires an explicit test database URL', () => {
  let commandStarted = false
  const errors = []
  const status = setupTestDatabase({
    environment: { DATABASE_URL: localEnvironment.DATABASE_URL },
    error: (message) => errors.push(message),
    log: () => {},
    run: () => {
      commandStarted = true
      return { status: 0 }
    },
  })

  assert.equal(status, 2)
  assert.equal(commandStarted, false)
  assert.deepEqual(errors, ['Test database setup NOT RUN: TEST_DATABASE_URL is required.'])
})

test('test database setup refuses the runtime database before invoking Docker', () => {
  let commandStarted = false
  const errors = []
  const status = setupTestDatabase({
    environment: {
      DATABASE_URL: localEnvironment.DATABASE_URL,
      TEST_DATABASE_URL: localEnvironment.DATABASE_URL,
    },
    error: (message) => errors.push(message),
    log: () => {},
    run: () => {
      commandStarted = true
      return { status: 0 }
    },
  })

  assert.equal(status, 2)
  assert.equal(commandStarted, false)
  assert.deepEqual(errors, [
    'Test database setup NOT RUN: TEST_DATABASE_URL must point to a different database than DATABASE_URL.',
  ])
})
