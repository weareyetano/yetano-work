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

export const caseClosedEvent = defineEvent({
  description: 'An open case was closed.',
  id: 'case.closed',
  payloadSchema: CaseEventPayloadSchema,
  schemaVersion: 1,
})

export const caseReopenedEvent = defineEvent({
  description: 'A closed case was reopened.',
  id: 'case.reopened',
  payloadSchema: CaseEventPayloadSchema,
  schemaVersion: 1,
})

export const casesEvents = [
  caseCreatedEvent,
  caseUpdatedEvent,
  caseClosedEvent,
  caseReopenedEvent,
] as const
