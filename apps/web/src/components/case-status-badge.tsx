import {
  RiAddCircleLine,
  RiArchiveLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiPauseLine,
  RiPlayLine,
} from '@remixicon/react'
import type { ListCasesResponse } from '@yetano/api-client'

import { Badge } from '#components/ui/badge'
import { cn } from '#lib/utils'

type CaseStatus = ListCasesResponse['items'][number]['status']

export function CaseStatusBadge({ className, status }: { className?: string; status: CaseStatus }) {
  const StatusIcon = {
    canceled: RiCloseCircleLine,
    new: RiAddCircleLine,
    postponed: RiArchiveLine,
    resolved: RiCheckboxCircleLine,
    waiting: RiPauseLine,
    working: RiPlayLine,
  }[status]

  return (
    <Badge
      className={cn('h-6 px-2.5 text-sm', statusBadgeTone(status), className)}
      variant="outline"
    >
      <StatusIcon aria-hidden="true" data-icon="inline-start" />
      {caseStatusLabel(status)}
    </Badge>
  )
}

function statusBadgeTone(status: CaseStatus) {
  if (status === 'waiting') {
    return 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200'
  }
  if (status === 'working') {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
  }
  return 'bg-background'
}

function caseStatusLabel(status: CaseStatus) {
  return {
    canceled: 'Anulowana',
    new: 'Nowa',
    postponed: 'Odłożona',
    resolved: 'Rozwiązana',
    waiting: 'Czekamy',
    working: 'Pracujemy',
  }[status]
}
