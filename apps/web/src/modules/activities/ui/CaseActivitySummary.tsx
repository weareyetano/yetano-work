import { RiHistoryLine } from '@remixicon/react'
import { useQuery } from '@tanstack/react-query'
import type { Ref } from 'react'

import { CaseStatusBadge } from '#components/case-status-badge'
import { Button } from '#components/ui/button'

import {
  type ActivityStatus,
  activityQueryKeys,
  fetchCurrentStatusActivity,
} from '../activities.api'
import { formatActivityDate } from './ActivityTimeline'

const ACTIVITY_REFRESH_MS = 2_000

export function CaseActivitySummary({
  caseId,
  caseVersion,
  fallbackOccurredAt,
  onOpen,
  status,
  triggerRef,
}: {
  caseId: string
  caseVersion: number
  fallbackOccurredAt: string
  onOpen(): void
  status: ActivityStatus
  triggerRef?: Ref<HTMLButtonElement>
}) {
  const currentStatus = useQuery({
    queryFn: () => fetchCurrentStatusActivity(caseId, status),
    queryKey: activityQueryKeys.currentStatus(caseId, status, caseVersion),
    refetchInterval: (query) => (query.state.data ? false : ACTIVITY_REFRESH_MS),
    refetchIntervalInBackground: false,
  })
  const occurredAt = currentStatus.data?.occurredAt ?? fallbackOccurredAt

  return (
    <div className="mt-6 flex items-center gap-3 rounded-xl bg-muted px-3 py-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold">Status sprawy:</span>{' '}
        <CaseStatusBadge status={status} />
      </div>
      <time
        className="ml-auto font-mono text-sm text-right text-muted-foreground"
        dateTime={occurredAt}
      >
        {formatActivityDate(occurredAt)}
      </time>
      <Button
        ref={triggerRef}
        aria-label="Pokaż aktywność"
        onPress={onOpen}
        size="icon"
        type="button"
        variant="ghost"
      >
        <RiHistoryLine aria-hidden="true" />
      </Button>
    </div>
  )
}
