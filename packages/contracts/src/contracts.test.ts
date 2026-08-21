import { Compile } from 'typebox/compile'
import { describe, expect, it } from 'vitest'

import {
  CaseListSchema,
  CaseSchema,
  CaseStatusChangeSchema,
  ChangeCaseStatusRequestSchema,
  CreateCaseRequestSchema,
  HealthResponseSchema,
  ProblemDetailsSchema,
  UpdateCaseRequestSchema,
} from './index.js'

describe('public API contracts', () => {
  it('accepts a valid health response and rejects additional fields', () => {
    const validator = Compile(HealthResponseSchema)

    expect(validator.Check({ database: 'up', status: 'ok', version: '0.1.0' })).toBe(true)
    expect(validator.Check({ database: 'up', extra: true, status: 'ok', version: '0.1.0' })).toBe(
      false,
    )
  })

  it('accepts RFC 9457 problem details', () => {
    const validator = Compile(ProblemDetailsSchema)

    expect(
      validator.Check({
        detail: 'The resource does not exist.',
        status: 404,
        title: 'Not Found',
        type: 'about:blank',
      }),
    ).toBe(true)
  })

  it('accepts a case response and rejects an invalid organization id', () => {
    const validator = Compile(CaseSchema)
    const value = {
      closedAt: null,
      createdAt: '2026-08-19T10:00:00.000Z',
      customerId: null,
      description: null,
      id: '8d19dfee-e908-4e4f-8450-ccbcd82f2319',
      organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
      status: 'new',
      statusNote: null,
      title: 'Prepare the proposal',
      updatedAt: '2026-08-19T10:00:00.000Z',
      version: 1,
    }

    expect(validator.Check(value)).toBe(true)
    expect(validator.Check({ ...value, organizationId: 'not-a-uuid' })).toBe(false)
  })

  it('keeps organization scope and lifecycle fields out of create input', () => {
    const validator = Compile(CreateCaseRequestSchema)

    expect(validator.Check({ title: 'Internal case' })).toBe(true)
    expect(
      validator.Check({
        organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
        title: 'Injected scope',
      }),
    ).toBe(false)
  })

  it('requires optimistic concurrency for updates', () => {
    const validator = Compile(UpdateCaseRequestSchema)

    expect(validator.Check({ expectedVersion: 2, title: 'Updated title' })).toBe(true)
    expect(validator.Check({ title: 'Missing version' })).toBe(false)
  })

  it('accepts allowed status transitions and requires waiting and cancellation notes', () => {
    const validator = Compile(ChangeCaseStatusRequestSchema)
    const identity = {
      expectedVersion: 2,
      transitionId: 'ad7e261c-61c6-4d35-a9de-b625c68d42a7',
    }

    expect(validator.Check({ ...identity, fromStatus: 'new', toStatus: 'working' })).toBe(true)
    expect(validator.Check({ ...identity, fromStatus: 'working', toStatus: 'waiting' })).toBe(false)
    expect(
      validator.Check({
        ...identity,
        fromStatus: 'working',
        note: 'Customer reply',
        toStatus: 'waiting',
      }),
    ).toBe(true)
    expect(validator.Check({ ...identity, fromStatus: 'new', toStatus: 'canceled' })).toBe(false)
    expect(validator.Check({ ...identity, fromStatus: 'resolved', toStatus: 'working' })).toBe(true)
    expect(validator.Check({ ...identity, fromStatus: 'working', toStatus: 'new' })).toBe(false)
  })

  it('accepts immutable case status history entries', () => {
    const validator = Compile(CaseStatusChangeSchema)

    expect(
      validator.Check({
        actorId: 'local-dev',
        actorType: 'user',
        caseId: '8d19dfee-e908-4e4f-8450-ccbcd82f2319',
        caseVersion: 2,
        changedAt: '2026-08-19T11:00:00.000Z',
        fromStatus: 'working',
        id: '099ec33b-0f7d-4d7c-bc4a-b7520217f96e',
        note: 'Waiting for a reply.',
        source: 'runtime',
        toStatus: 'waiting',
        transitionId: 'ad7e261c-61c6-4d35-a9de-b625c68d42a7',
        type: 'transitioned',
      }),
    ).toBe(true)
  })

  it('requires a bounded case-list response', () => {
    const validator = Compile(CaseListSchema)

    expect(validator.Check({ items: [], nextCursor: null })).toBe(true)
    expect(validator.Check({ items: [], nextCursor: null, total: 0 })).toBe(false)
  })
})
