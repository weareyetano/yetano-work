import {
  RiAddCircleLine,
  RiArchiveLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiPauseLine,
  RiPlayLine,
} from '@remixicon/react'
import type { ListCasesResponse } from '@yetano/api-client'
import type { ComponentProps } from 'react'

import { Badge } from '#components/ui/badge'

type CaseStatus = ListCasesResponse['items'][number]['status']
type StatusBadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

export function CaseStatusBadge({ className, status }: { className?: string; status: CaseStatus }) {
  const { icon: StatusIcon, label, variant } = statusPresentation[status]

  return (
    <Badge className={className} variant={variant}>
      <StatusIcon aria-hidden="true" data-icon="inline-start" />
      {label}
    </Badge>
  )
}

const statusPresentation = {
  canceled: { icon: RiCloseCircleLine, label: 'Anulowana', variant: 'danger' },
  new: { icon: RiAddCircleLine, label: 'Nowa', variant: 'info' },
  postponed: { icon: RiArchiveLine, label: 'Odłożona', variant: 'neutral' },
  resolved: { icon: RiCheckboxCircleLine, label: 'Rozwiązana', variant: 'success' },
  waiting: { icon: RiPauseLine, label: 'Czekamy', variant: 'notice' },
  working: { icon: RiPlayLine, label: 'Pracujemy', variant: 'warning' },
} as const satisfies Record<
  CaseStatus,
  { icon: typeof RiAddCircleLine; label: string; variant: StatusBadgeVariant }
>
