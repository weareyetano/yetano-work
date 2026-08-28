import type {
  Activity,
  ActivityList,
  ActivityListQuery,
  CaseId,
  CreateActivityNoteRequest,
} from '@yetano/contracts'

import { defineOperation } from '../../platform/execution/operation.js'
import { ACTIVITIES_CAPABILITIES } from './activities.capabilities.js'

export interface CaseActivityInput<Request> {
  caseId: CaseId
  request: Request
}

export interface CreateActivityNoteResult {
  activity: Activity
  created: boolean
}

export const listCaseActivitiesOperation = defineOperation<
  CaseActivityInput<ActivityListQuery>,
  ActivityList
>({
  capability: ACTIVITIES_CAPABILITIES.read,
  id: 'activities.list-case',
  kind: 'query',
})

export const createActivityNoteOperation = defineOperation<
  CaseActivityInput<CreateActivityNoteRequest>,
  CreateActivityNoteResult
>({
  capability: ACTIVITIES_CAPABILITIES.createNote,
  id: 'activities.create-note',
  kind: 'command',
})

export const activitiesOperations = [
  createActivityNoteOperation,
  listCaseActivitiesOperation,
] as const
