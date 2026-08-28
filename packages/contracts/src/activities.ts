import Type from 'typebox'
import { CaseStatusSchema } from './cases.js'
import { CaseIdSchema } from './ids.js'

export const ActivityCursorSchema = Type.String({
  description: 'Opaque cursor returned by a previous case-activity request.',
  minLength: 1,
  title: 'ActivityCursor',
})

export type ActivityCursor = Type.Static<typeof ActivityCursorSchema>

export const ActivityListLimitSchema = Type.Integer({
  description: 'Maximum number of activities returned in one page.',
  maximum: 100,
  minimum: 1,
  title: 'ActivityListLimit',
})

export type ActivityListLimit = Type.Static<typeof ActivityListLimitSchema>

export const ActivityContentSchema = Type.String({
  description: 'Trimmed, non-blank activity note content.',
  maxLength: 10_000,
  minLength: 1,
  pattern: '\\S',
  title: 'ActivityContent',
})

export type ActivityContent = Type.Static<typeof ActivityContentSchema>

const ActivityActorSchema = Type.Union([Type.Literal('system'), Type.Literal('user')])
const ActivityCommonProperties = {
  actorId: Type.String({ maxLength: 255, minLength: 1 }),
  actorType: ActivityActorSchema,
  caseId: CaseIdSchema,
  id: Type.String({ format: 'uuid' }),
  occurredAt: Type.String({ format: 'date-time' }),
}

export const NoteActivitySchema = Type.Object(
  {
    ...ActivityCommonProperties,
    content: ActivityContentSchema,
    type: Type.Literal('note'),
  },
  { additionalProperties: false, title: 'NoteActivity' },
)

export const CaseCreatedActivitySchema = Type.Object(
  {
    ...ActivityCommonProperties,
    caseVersion: Type.Integer({ minimum: 1 }),
    type: Type.Literal('case_created'),
  },
  { additionalProperties: false, title: 'CaseCreatedActivity' },
)

export const CaseStatusChangedActivitySchema = Type.Object(
  {
    ...ActivityCommonProperties,
    caseVersion: Type.Integer({ minimum: 1 }),
    fromStatus: CaseStatusSchema,
    note: Type.Union([Type.String({ maxLength: 2_000, minLength: 1 }), Type.Null()]),
    toStatus: CaseStatusSchema,
    type: Type.Literal('case_status_changed'),
  },
  { additionalProperties: false, title: 'CaseStatusChangedActivity' },
)

export const ActivitySchema = Type.Union(
  [NoteActivitySchema, CaseCreatedActivitySchema, CaseStatusChangedActivitySchema],
  {
    description: 'An immutable item in a case activity timeline.',
    title: 'Activity',
  },
)

export type Activity = Type.Static<typeof ActivitySchema>

export const ActivityListQuerySchema = Type.Object(
  {
    cursor: Type.Optional(ActivityCursorSchema),
    limit: Type.Optional(ActivityListLimitSchema),
  },
  {
    additionalProperties: false,
    description: 'Cursor pagination for a case activity timeline.',
    title: 'ActivityListQuery',
  },
)

export type ActivityListQuery = Type.Static<typeof ActivityListQuerySchema>

export const ActivityListSchema = Type.Object(
  {
    items: Type.Array(ActivitySchema),
    nextCursor: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  },
  {
    additionalProperties: false,
    description: 'A cursor-paginated case activity timeline.',
    title: 'ActivityList',
  },
)

export type ActivityList = Type.Static<typeof ActivityListSchema>

export const CreateActivityNoteRequestSchema = Type.Object(
  {
    activityId: Type.String({ format: 'uuid' }),
    content: ActivityContentSchema,
  },
  {
    additionalProperties: false,
    description: 'An idempotent request to append a note to a case activity timeline.',
    title: 'CreateActivityNoteRequest',
  },
)

export type CreateActivityNoteRequest = Type.Static<typeof CreateActivityNoteRequestSchema>

export const ActivityIdConflictSchema = Type.Object(
  {
    code: Type.Literal('activity_id_conflict'),
    detail: Type.Optional(Type.String()),
    instance: Type.Optional(Type.String()),
    requestId: Type.Optional(Type.String()),
    status: Type.Literal(409),
    title: Type.String(),
    type: Type.String({ format: 'uri-reference' }),
  },
  {
    additionalProperties: false,
    description: 'Problem details returned when an activity id is reused for another note.',
    title: 'ActivityIdConflict',
  },
)

export type ActivityIdConflict = Type.Static<typeof ActivityIdConflictSchema>
