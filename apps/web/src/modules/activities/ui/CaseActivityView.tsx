import { RiArrowRightSLine } from '@remixicon/react'

import { Button } from '#components/ui/button'

import { ActivityTimeline } from './ActivityTimeline'

export function CaseActivityView({
  caseId,
  caseTitle,
  disabled = false,
  onBack,
}: {
  caseId: string
  caseTitle: string
  disabled?: boolean
  onBack(): void
}) {
  const headingId = `case-activity-heading-${caseId}`

  return (
    <section aria-labelledby={headingId}>
      <nav aria-label="Ścieżka sprawy" className="mb-5">
        <ol className="flex min-w-0 items-center gap-1.5">
          <li className="min-w-0">
            <Button
              autoFocus
              aria-label={`Wróć do sprawy: ${caseTitle}`}
              className="h-auto max-w-[min(50vw,28rem)] p-0 text-muted-foreground"
              onPress={onBack}
              type="button"
              variant="link"
            >
              <span className="truncate">{caseTitle}</span>
            </Button>
          </li>
          <li aria-hidden="true" className="shrink-0 text-muted-foreground">
            <RiArrowRightSLine />
          </li>
          <li aria-current="page" className="shrink-0">
            <h3 className="text-base font-semibold" id={headingId}>
              Aktywność
            </h3>
          </li>
        </ol>
      </nav>
      <ActivityTimeline caseId={caseId} disabled={disabled} showHeading={false} />
    </section>
  )
}
