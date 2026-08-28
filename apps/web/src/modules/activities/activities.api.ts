import {
  type CreateActivityNoteResponse,
  createActivityNote,
  type ListCaseActivitiesResponse,
  listCaseActivities,
} from '@yetano/api-client'

export type ActivityItem = ListCaseActivitiesResponse['items'][number]
export type ActivityPage = ListCaseActivitiesResponse

export const activityQueryKeys = {
  all: ['activities'] as const,
  case(caseId: string) {
    return [...this.all, 'case', caseId] as const
  },
  currentStatus(caseId: string, status: ActivityStatus, caseVersion: number) {
    return [...this.all, 'current-status', caseId, status, caseVersion] as const
  },
}

export type ActivityStatus = Extract<ActivityItem, { type: 'case_status_changed' }>['toStatus']

export async function fetchCaseActivities(
  caseId: string,
  cursor: string | null,
  limit = 25,
): Promise<ListCaseActivitiesResponse> {
  const response = await listCaseActivities({
    path: { caseId },
    query: { ...(cursor ? { cursor } : {}), limit },
    throwOnError: true,
  })
  return response.data
}

export async function fetchCurrentStatusActivity(caseId: string, status: ActivityStatus) {
  let cursor: string | null = null
  const seenCursors = new Set<string>()

  do {
    const page = await fetchCaseActivities(caseId, cursor, 100)
    const latestLifecycleEntry = page.items.find((entry) => entry.type !== 'note')
    if (latestLifecycleEntry) {
      if (latestLifecycleEntry.type === 'case_created') {
        return status === 'new' ? latestLifecycleEntry : null
      }
      return latestLifecycleEntry.toStatus === status ? latestLifecycleEntry : null
    }

    cursor = page.nextCursor
    if (cursor && seenCursors.has(cursor)) return null
    if (cursor) seenCursors.add(cursor)
  } while (cursor)

  return null
}

export async function appendActivityNote({
  activityId,
  caseId,
  content,
}: {
  activityId: string
  caseId: string
  content: string
}): Promise<CreateActivityNoteResponse> {
  const response = await createActivityNote({
    body: { activityId, content },
    path: { caseId },
    throwOnError: true,
  })
  return response.data
}
