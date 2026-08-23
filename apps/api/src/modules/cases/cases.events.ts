import { CaseStatusSchema } from '@yetano/contracts'
import Type from 'typebox'

import { defineEvent } from '../module.js'

const CaseEventPayloadSchema = Type.Object(
  {
    caseId: Type.String({ format: 'uuid' }),
    caseVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
)

const CaseStatusV1Schema = Type.Union([
  Type.Literal('canceled'),
  Type.Literal('new'),
  Type.Literal('resolved'),
  Type.Literal('waiting'),
  Type.Literal('working'),
])

const CaseUpdatedPayloadSchema = Type.Object(
  {
    caseId: Type.String({ format: 'uuid' }),
    caseVersion: Type.Integer({ minimum: 1 }),
    changedFields: Type.Array(
      Type.Union([Type.Literal('customerId'), Type.Literal('description'), Type.Literal('title')]),
      { minItems: 1, uniqueItems: true },
    ),
  },
  { additionalProperties: false },
)

const CaseTransitionedPayloadV1Schema = Type.Object(
  {
    caseId: Type.String({ format: 'uuid' }),
    caseVersion: Type.Integer({ minimum: 1 }),
    fromStatus: CaseStatusV1Schema,
    toStatus: CaseStatusV1Schema,
    transitionId: Type.String({ format: 'uuid' }),
  },
  { additionalProperties: false },
)

const CaseTransitionedPayloadV2Schema = Type.Object(
  {
    caseId: Type.String({ format: 'uuid' }),
    caseVersion: Type.Integer({ minimum: 1 }),
    fromStatus: CaseStatusSchema,
    toStatus: CaseStatusSchema,
    transitionId: Type.String({ format: 'uuid' }),
  },
  { additionalProperties: false },
)

const CaseTransitionedPayloadV3Schema = Type.Object(
  {
    caseId: Type.String({ format: 'uuid' }),
    caseVersion: Type.Integer({ minimum: 1 }),
    fromStatus: CaseStatusSchema,
    note: Type.Union([Type.String({ maxLength: 2_000, minLength: 1 }), Type.Null()]),
    statusChangeId: Type.String({ format: 'uuid' }),
    toStatus: CaseStatusSchema,
    transitionId: Type.String({ format: 'uuid' }),
  },
  { additionalProperties: false },
)

export const caseCreatedEvent = defineEvent({
  description: 'A case was created.',
  id: 'case.created',
  schemaVersion: 1,
  versions: [{ payloadSchema: CaseEventPayloadSchema, schemaVersion: 1 }],
})

export const caseUpdatedEvent = defineEvent({
  description: 'Editable case fields changed.',
  id: 'case.updated',
  schemaVersion: 1,
  versions: [{ payloadSchema: CaseUpdatedPayloadSchema, schemaVersion: 1 }],
})

export const caseTransitionedEvent = defineEvent({
  description: 'A case lifecycle status changed.',
  id: 'case.transitioned',
  schemaVersion: 3,
  versions: [
    { payloadSchema: CaseTransitionedPayloadV1Schema, schemaVersion: 1 },
    { payloadSchema: CaseTransitionedPayloadV2Schema, schemaVersion: 2 },
    { payloadSchema: CaseTransitionedPayloadV3Schema, schemaVersion: 3 },
  ],
})

export const casesEvents = [caseCreatedEvent, caseUpdatedEvent, caseTransitionedEvent] as const
