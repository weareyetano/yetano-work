import { Compile } from 'typebox/compile'
import { describe, expect, it } from 'vitest'

import {
  CaseListSchema,
  CaseSchema,
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
      status: 'open',
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

  it('requires a bounded case-list response', () => {
    const validator = Compile(CaseListSchema)

    expect(validator.Check({ items: [], nextCursor: null })).toBe(true)
    expect(validator.Check({ items: [], nextCursor: null, total: 0 })).toBe(false)
  })
})
