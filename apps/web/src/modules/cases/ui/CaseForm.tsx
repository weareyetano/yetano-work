import { RiErrorWarningLine } from '@remixicon/react'
import type { FormEvent, ReactNode, Ref } from 'react'

import { Alert, AlertDescription } from '#components/ui/alert'
import { Button } from '#components/ui/button'
import { Field, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { Spinner } from '#components/ui/spinner'
import { Textarea } from '#components/ui/textarea'
import { cn } from '#lib/utils'

import type { CaseItem } from '../cases.api'
import { type CaseFormValue, caseFormValue, ErrorNotice } from './case-workspace.shared'

export function CaseForm({
  ariaLabel,
  busy,
  busyLabel = 'Zapisywanie…',
  error,
  footerActions,
  isDirty,
  onCancel,
  onChange,
  onSubmit,
  submitLabel,
  titleRef,
  value,
}: {
  ariaLabel?: string
  busy: boolean
  busyLabel?: string
  error: Error | null
  footerActions?: ReactNode
  isDirty: boolean
  onCancel?(): void
  onChange(value: CaseFormValue): void
  onSubmit(value: CaseFormValue): Promise<unknown>
  submitLabel: string
  titleRef?: Ref<HTMLInputElement>
  value: CaseFormValue
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await onSubmit({
        customerId: value.customerId,
        description: optionalText(value.description),
        title: value.title.trim(),
      })
    } catch {
      // The mutation exposes the error in the visible notice below.
    }
  }

  return (
    <form aria-label={ariaLabel} onSubmit={(event) => void submit(event)}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="case-title">
            Tytuł{' '}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </FieldLabel>
          <Input
            aria-label="Tytuł"
            ref={titleRef}
            id="case-title"
            maxLength={200}
            name="title"
            required
            disabled={busy}
            value={value.title}
            onChange={(event) => {
              onChange({ ...value, title: event.target.value })
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="case-description">Opis</FieldLabel>
          <Textarea
            className="min-h-24 resize-y"
            id="case-description"
            maxLength={10_000}
            name="description"
            disabled={busy}
            value={value.description ?? ''}
            onChange={(event) => {
              onChange({ ...value, description: event.target.value })
            }}
          />
        </Field>
        <div
          className={cn(
            'grid min-h-10 items-center gap-2 min-[721px]:flex min-[721px]:flex-wrap',
            footerActions ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          <Button
            className={cn(footerActions && 'w-full min-[721px]:w-auto')}
            isDisabled={busy}
            type="submit"
          >
            {busy ? <Spinner aria-hidden="true" className="motion-reduce:animate-none" /> : null}
            {busy ? busyLabel : submitLabel}
          </Button>
          {onCancel ? (
            <Button isDisabled={busy} onPress={onCancel} type="button" variant="outline">
              Anuluj
            </Button>
          ) : null}
          {footerActions}
          {isDirty && !busy ? (
            <span className="col-span-full text-base text-muted-foreground" role="status">
              Niezapisane zmiany.
            </span>
          ) : null}
        </div>
        {error ? <ErrorNotice className="my-0" error={error} /> : null}
      </FieldGroup>
    </form>
  )
}

export function CaseConflictNotice({
  draft,
  onLoadServerVersion,
  serverCase,
  serverVersion,
}: {
  draft: CaseFormValue
  onLoadServerVersion(): void
  serverCase: CaseItem
  serverVersion: number
}) {
  const serverIsNewer = serverCase.version > serverVersion
  return (
    <Alert className="my-3.5" variant="destructive">
      <RiErrorWarningLine aria-hidden="true" />
      <AlertDescription className="grid gap-2 text-status-danger-foreground">
        <strong>Sprawa została zmieniona w innym miejscu. Lokalny szkic został zachowany.</strong>
        <span>
          Wersja serwera {serverCase.version}: {caseDraftSummary(caseFormValue(serverCase))}
        </span>
        <span>
          Lokalny szkic dla wersji {serverVersion}: {caseDraftSummary(draft)}
        </span>
        <Button
          className="w-fit"
          isDisabled={!serverIsNewer}
          onPress={onLoadServerVersion}
          size="sm"
          type="button"
          variant="outline"
        >
          {serverIsNewer ? 'Załaduj wersję z serwera' : 'Pobieranie wersji serwera…'}
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function caseDraftSummary(value: CaseFormValue) {
  return `${value.title} — ${value.description || 'bez opisu'}`
}

function optionalText(value: FormDataEntryValue | null) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}
