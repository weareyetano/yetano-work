import Type, { type TSchema } from 'typebox'

import { CaseIdSchema, CustomerIdSchema, OrganizationIdSchema } from './ids.js'

const StatusNoteSchema = Type.String({ maxLength: 2_000, minLength: 1 })
const ActiveCaseStatusSchema = Type.Union([
  Type.Literal('new'),
  Type.Literal('waiting'),
  Type.Literal('working'),
])
const TerminalCaseStatusSchema = Type.Union([Type.Literal('canceled'), Type.Literal('resolved')])

export const CaseStatusSchema = Type.Union(
  [
    Type.Literal('new'),
    Type.Literal('working'),
    Type.Literal('waiting'),
    Type.Literal('resolved'),
    Type.Literal('canceled'),
  ],
  {
    description: 'Current lifecycle status of a case.',
    title: 'CaseStatus',
  },
)

export type CaseStatus = Type.Static<typeof CaseStatusSchema>

export const CaseStatusGroupSchema = Type.Union([Type.Literal('open'), Type.Literal('closed')], {
  description: 'Open or closed lifecycle group used to filter cases.',
  title: 'CaseStatusGroup',
})

export type CaseStatusGroup = Type.Static<typeof CaseStatusGroupSchema>

export const CaseSchema = Type.Object(
  {
    closedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    customerId: Type.Union([CustomerIdSchema, Type.Null()]),
    description: Type.Union([Type.String({ maxLength: 10_000 }), Type.Null()]),
    id: CaseIdSchema,
    organizationId: OrganizationIdSchema,
    status: CaseStatusSchema,
    statusNote: Type.Union([StatusNoteSchema, Type.Null()]),
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

const TransitionIdentityProperties = {
  expectedVersion: Type.Integer({ minimum: 1 }),
  transitionId: Type.String({ format: 'uuid' }),
}

function transitionVariant<
  const FromStatus extends TSchema,
  const ToStatus extends TSchema,
  const Note extends TSchema,
>(fromStatus: FromStatus, toStatus: ToStatus, note: Note) {
  return Type.Object(
    {
      ...TransitionIdentityProperties,
      fromStatus,
      note,
      toStatus,
    },
    { additionalProperties: false },
  )
}

export const ChangeCaseStatusRequestSchema = Type.Union(
  [
    transitionVariant(
      Type.Literal('new'),
      Type.Literal('working'),
      Type.Optional(StatusNoteSchema),
    ),
    transitionVariant(Type.Literal('new'), Type.Literal('waiting'), StatusNoteSchema),
    transitionVariant(Type.Literal('working'), Type.Literal('waiting'), StatusNoteSchema),
    transitionVariant(
      Type.Literal('waiting'),
      Type.Literal('working'),
      Type.Optional(StatusNoteSchema),
    ),
    transitionVariant(
      ActiveCaseStatusSchema,
      Type.Literal('resolved'),
      Type.Optional(StatusNoteSchema),
    ),
    transitionVariant(ActiveCaseStatusSchema, Type.Literal('canceled'), StatusNoteSchema),
    transitionVariant(
      TerminalCaseStatusSchema,
      Type.Literal('working'),
      Type.Optional(StatusNoteSchema),
    ),
  ],
  {
    description: 'An idempotent, optimistic case lifecycle transition.',
    title: 'ChangeCaseStatusRequest',
  },
)

export type ChangeCaseStatusRequest = Type.Static<typeof ChangeCaseStatusRequestSchema>

export const CaseStatusChangeSchema = Type.Object(
  {
    actorId: Type.String({ minLength: 1 }),
    actorType: Type.Union([Type.Literal('system'), Type.Literal('user')]),
    caseId: CaseIdSchema,
    caseVersion: Type.Integer({ minimum: 1 }),
    changedAt: Type.String({ format: 'date-time' }),
    fromStatus: Type.Union([CaseStatusSchema, Type.Null()]),
    id: Type.String({ format: 'uuid' }),
    note: Type.Union([StatusNoteSchema, Type.Null()]),
    source: Type.Union([Type.Literal('migration'), Type.Literal('runtime')]),
    toStatus: CaseStatusSchema,
    transitionId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    type: Type.Union([Type.Literal('created'), Type.Literal('transitioned')]),
  },
  {
    additionalProperties: false,
    description: 'An immutable entry in a case status history.',
    title: 'CaseStatusChange',
  },
)

export type CaseStatusChange = Type.Static<typeof CaseStatusChangeSchema>

export const CaseStatusHistoryQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({ minLength: 1 })),
    limit: Type.Optional(Type.Integer({ maximum: 100, minimum: 1 })),
  },
  {
    additionalProperties: false,
    description: 'Cursor pagination for a case status history.',
    title: 'CaseStatusHistoryQuery',
  },
)

export type CaseStatusHistoryQuery = Type.Static<typeof CaseStatusHistoryQuerySchema>

export const CaseStatusHistorySchema = Type.Object(
  {
    items: Type.Array(CaseStatusChangeSchema),
    nextCursor: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  },
  {
    additionalProperties: false,
    description: 'A cursor-paginated case status history.',
    title: 'CaseStatusHistory',
  },
)

export type CaseStatusHistory = Type.Static<typeof CaseStatusHistorySchema>

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
    status: Type.Optional(
      Type.Union([
        CaseStatusSchema,
        Type.Array(CaseStatusSchema, { maxItems: 5, minItems: 1, uniqueItems: true }),
      ]),
    ),
    statusGroup: Type.Optional(CaseStatusGroupSchema),
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

export const CaseTransitionIdConflictSchema = Type.Object(
  {
    code: Type.Literal('case_transition_id_conflict'),
    detail: Type.Optional(Type.String()),
    instance: Type.Optional(Type.String()),
    requestId: Type.Optional(Type.String()),
    status: Type.Literal(409),
    title: Type.String(),
    type: Type.String({ format: 'uri-reference' }),
  },
  {
    additionalProperties: false,
    description: 'Problem details returned when a transition id is reused for another command.',
    title: 'CaseTransitionIdConflict',
  },
)

export type CaseTransitionIdConflict = Type.Static<typeof CaseTransitionIdConflictSchema>
