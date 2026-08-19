import Type from 'typebox'

export const HealthResponseSchema = Type.Object(
  {
    database: Type.Literal('up'),
    status: Type.Literal('ok'),
    version: Type.String({ minLength: 1 }),
  },
  {
    additionalProperties: false,
    description: 'Current health of the Yetano Work API and its database connection.',
    title: 'HealthResponse',
  },
)

export type HealthResponse = Type.Static<typeof HealthResponseSchema>

export const ProblemDetailsSchema = Type.Object(
  {
    detail: Type.Optional(Type.String()),
    instance: Type.Optional(Type.String()),
    requestId: Type.Optional(Type.String()),
    status: Type.Integer({ maximum: 599, minimum: 400 }),
    title: Type.String(),
    type: Type.String({ format: 'uri-reference' }),
  },
  {
    additionalProperties: true,
    description: 'RFC 9457 problem details returned by the Yetano Work API.',
    title: 'ProblemDetails',
  },
)

export type ProblemDetails = Type.Static<typeof ProblemDetailsSchema>
