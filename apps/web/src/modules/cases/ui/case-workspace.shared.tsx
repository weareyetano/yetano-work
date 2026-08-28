import { RiErrorWarningLine } from '@remixicon/react'

import { Alert, AlertAction, AlertDescription } from '#components/ui/alert'
import { Button } from '#components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '#components/ui/empty'
import { Spinner } from '#components/ui/spinner'
import { cn } from '#lib/utils'

import { type CaseItem, type CaseListView, isCaseVersionConflict } from '../cases.api'

export interface CaseFormValue {
  customerId: string | null
  description: string | null
  title: string
}

export const EMPTY_CASE_FORM_VALUE: CaseFormValue = {
  customerId: null,
  description: null,
  title: '',
}

export function caseFormValue(caseItem: CaseItem): CaseFormValue {
  return {
    customerId: caseItem.customerId,
    description: caseItem.description,
    title: caseItem.title,
  }
}

export function caseFormValuesEqual(left: CaseFormValue, right: CaseFormValue) {
  return (
    left.customerId === right.customerId &&
    left.description === right.description &&
    left.title === right.title
  )
}

export function ErrorNotice({
  className,
  error,
  retry,
}: {
  className?: string
  error: unknown
  retry?: () => unknown
}) {
  return (
    <Alert className={cn('my-3.5', retry ? 'pr-36' : undefined, className)} variant="destructive">
      <RiErrorWarningLine aria-hidden="true" />
      <AlertDescription className="text-destructive">{readError(error)}</AlertDescription>
      {retry ? (
        <AlertAction>
          <Button onPress={() => retry()} size="sm" type="button" variant="outline">
            Spróbuj ponownie
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  )
}

export function CaseEmptyState({ description, title }: { description?: string; title: string }) {
  return (
    <Empty className="min-h-[390px]">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  )
}

export function LoadingStatus({ className, label }: { className?: string; label: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground',
        className,
      )}
      role="status"
    >
      <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
      <span>{label}</span>
    </div>
  )
}

export function isOpenStatus(status: CaseItem['status']) {
  return status === 'new' || status === 'working' || status === 'waiting'
}

export function statusLabel(status: CaseItem['status']) {
  return {
    canceled: 'Anulowana',
    new: 'Nowa',
    postponed: 'Odłożona',
    resolved: 'Rozwiązana',
    waiting: 'Czekamy',
    working: 'Pracujemy',
  }[status]
}

export function caseListViewForStatus(status: CaseItem['status']): CaseListView {
  if (status === 'canceled' || status === 'resolved') return 'closed'
  return status === 'postponed' ? 'postponed' : 'open'
}

export function caseListEmptyState(view: CaseListView, search: string) {
  if (search) {
    return {
      description: 'Spróbuj innej frazy albo wyczyść wyszukiwanie.',
      title: 'Brak pasujących spraw.',
    }
  }
  return {
    closed: {
      description: 'Rozwiązane i anulowane sprawy pojawią się tutaj.',
      title: 'Brak zamkniętych spraw.',
    },
    open: {
      description: 'Nowe i aktywne sprawy pojawią się tutaj.',
      title: 'Brak otwartych spraw.',
    },
    postponed: {
      description: 'Nową sprawę możesz odłożyć na później.',
      title: 'Brak odłożonych spraw.',
    },
  }[view]
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function readError(error: unknown) {
  if (isCaseVersionConflict(error)) {
    return 'Sprawa została zmieniona w innym miejscu. Sprawdź odświeżone dane i wybierz właściwą akcję.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Nie udało się wykonać operacji. Odśwież dane i spróbuj ponownie.'
}
