import { Compile } from 'typebox/compile'
import { describe, expect, it } from 'vitest'

import { HealthResponseSchema, ProblemDetailsSchema } from './index.js'

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
})
