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

const CaseTransitionedPayloadSchema = Type.Object(
  {
    caseId: Type.String({ format: 'uuid' }),
    caseVersion: Type.Integer({ minimum: 1 }),
    fromStatus: CaseStatusSchema,
    toStatus: CaseStatusSchema,
    transitionId: Type.String({ format: 'uuid' }),
  },
  { additionalProperties: false },
)

export const caseCreatedEvent = defineEvent({
  description: 'A case was created.',
  id: 'case.created',
  payloadSchema: CaseEventPayloadSchema,
  schemaVersion: 1,
})

export const caseUpdatedEvent = defineEvent({
  description: 'Editable case fields changed.',
  id: 'case.updated',
  payloadSchema: CaseUpdatedPayloadSchema,
  schemaVersion: 1,
})

export const caseTransitionedEvent = defineEvent({
  description: 'A case lifecycle status changed.',
  id: 'case.transitioned',
  payloadSchema: CaseTransitionedPayloadSchema,
  schemaVersion: 2,
})

export const casesEvents = [caseCreatedEvent, caseUpdatedEvent, caseTransitionedEvent] as const
