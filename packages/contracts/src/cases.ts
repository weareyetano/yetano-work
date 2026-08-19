import Type from 'typebox'

import { CaseIdSchema, CustomerIdSchema, OrganizationIdSchema } from './ids.js'

export const CaseStatusSchema = Type.Union([Type.Literal('open'), Type.Literal('closed')], {
  description: 'Current lifecycle status of a case.',
  title: 'CaseStatus',
})

export type CaseStatus = Type.Static<typeof CaseStatusSchema>

export const CaseSchema = Type.Object(
  {
    closedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    customerId: Type.Union([CustomerIdSchema, Type.Null()]),
    description: Type.Union([Type.String({ maxLength: 10_000 }), Type.Null()]),
    id: CaseIdSchema,
    organizationId: OrganizationIdSchema,
    status: CaseStatusSchema,
    title: Type.String({ maxLength: 200, minLength: 1 }),
    updatedAt: Type.String({ format: 'date-time' }),
    version: Type.Integer({ minimum: 1 }),
  },
  {
    additionalProperties: false,
    description: 'An organization-scoped case.',
    title: 'Case',
  },
)

export type Case = Type.Static<typeof CaseSchema>

export const CreateCaseRequestSchema = Type.Object(
  {
    customerId: Type.Optional(Type.Union([CustomerIdSchema, Type.Null()])),
    description: Type.Optional(Type.Union([Type.String({ maxLength: 10_000 }), Type.Null()])),
    title: Type.String({ maxLength: 200, minLength: 1 }),
  },
  {
    additionalProperties: false,
    description: 'Fields accepted when creating a case.',
    title: 'CreateCaseRequest',
  },
)

export type CreateCaseRequest = Type.Static<typeof CreateCaseRequestSchema>

export const UpdateCaseRequestSchema = Type.Object(
  {
    customerId: Type.Optional(Type.Union([CustomerIdSchema, Type.Null()])),
    description: Type.Optional(Type.Union([Type.String({ maxLength: 10_000 }), Type.Null()])),
    expectedVersion: Type.Integer({ minimum: 1 }),
    title: Type.Optional(Type.String({ maxLength: 200, minLength: 1 })),
  },
  {
    additionalProperties: false,
    description: 'Editable case fields and the expected optimistic-lock version.',
    title: 'UpdateCaseRequest',
  },
)

export type UpdateCaseRequest = Type.Static<typeof UpdateCaseRequestSchema>

export const TransitionCaseRequestSchema = Type.Object(
  {
    expectedVersion: Type.Integer({ minimum: 1 }),
  },
  {
    additionalProperties: false,
    description: 'Expected version for an idempotent case lifecycle transition.',
    title: 'TransitionCaseRequest',
  },
)

export type TransitionCaseRequest = Type.Static<typeof TransitionCaseRequestSchema>

export const CasePathParametersSchema = Type.Object(
  { caseId: CaseIdSchema },
  { additionalProperties: false, title: 'CasePathParameters' },
)

export type CasePathParameters = Type.Static<typeof CasePathParametersSchema>

export const ListCasesQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({ minLength: 1 })),
    customerId: Type.Optional(CustomerIdSchema),
    limit: Type.Optional(Type.Integer({ maximum: 100, minimum: 1 })),
    status: Type.Optional(CaseStatusSchema),
  },
  {
    additionalProperties: false,
    description: 'Cursor pagination and optional case filters.',
    title: 'ListCasesQuery',
  },
)

export type ListCasesQuery = Type.Static<typeof ListCasesQuerySchema>

export const CaseListSchema = Type.Object(
  {
    items: Type.Array(CaseSchema),
    nextCursor: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  },
  {
    additionalProperties: false,
    description: 'A cursor-paginated list of cases.',
    title: 'CaseList',
  },
)

export type CaseList = Type.Static<typeof CaseListSchema>

export const CaseVersionConflictSchema = Type.Object(
  {
    code: Type.Literal('case_version_conflict'),
    currentVersion: Type.Integer({ minimum: 1 }),
    detail: Type.Optional(Type.String()),
    instance: Type.Optional(Type.String()),
    requestId: Type.Optional(Type.String()),
    status: Type.Literal(409),
    title: Type.String(),
    type: Type.String({ format: 'uri-reference' }),
  },
  {
    additionalProperties: false,
    description: 'Problem details returned for a stale case mutation.',
    title: 'CaseVersionConflict',
  },
)

export type CaseVersionConflict = Type.Static<typeof CaseVersionConflictSchema>
