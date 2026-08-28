import { RiArrowDownSLine } from '@remixicon/react'
import type { FormEvent, Ref } from 'react'

import { Button } from '#components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '#components/ui/dialog'
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from '#components/ui/dropdown-menu'
import { Field, FieldLabel } from '#components/ui/field'
import { Spinner } from '#components/ui/spinner'
import { Textarea } from '#components/ui/textarea'
import { cn } from '#lib/utils'

import type { CaseItem, CaseTransitionIntent } from '../cases.api'

export function CaseLifecycleActions({
  busy,
  caseItem,
  compactTriggerRef,
  isDesktop,
  onNotedTransition,
  onTransition,
}: {
  busy: boolean
  caseItem: CaseItem
  compactTriggerRef: Ref<HTMLButtonElement>
  isDesktop: boolean
  onNotedTransition(status: 'canceled' | 'waiting'): void
  onTransition(status: CaseTransitionIntent['toStatus']): void
}) {
  const actions = caseStatusActions(caseItem)
  const runAction = (action: CaseStatusAction) => {
    if (action.requiresNote) onNotedTransition(action.toStatus)
    else onTransition(action.toStatus)
  }

  if (!isDesktop) {
    return (
      <DropdownMenuTrigger>
        <Button
          ref={compactTriggerRef}
          className="w-full"
          isDisabled={busy}
          type="button"
          variant="outline"
        >
          {busy ? <Spinner aria-hidden="true" className="motion-reduce:animate-none" /> : null}
          {busy ? 'Zmiana statusu…' : 'Zmień status'}
          <RiArrowDownSLine aria-hidden="true" />
        </Button>
        <DropdownMenu aria-label="Zmień status" className="min-w-48">
          {actions.map((action) => (
            <DropdownMenuItem
              id={action.toStatus}
              key={action.toStatus}
              onAction={() => runAction(action)}
              variant={action.variant === 'destructive' ? 'destructive' : 'default'}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenu>
      </DropdownMenuTrigger>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Button
          className={cn(
            action.variant === 'destructive' && 'bg-destructive text-white hover:bg-destructive/90',
          )}
          isDisabled={busy}
          key={action.toStatus}
          onPress={() => runAction(action)}
          type="button"
          variant={action.variant}
        >
          {busy && actions.length === 1 ? (
            <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
          ) : null}
          {busy && actions.length === 1 ? 'Zapisywanie…' : action.label}
        </Button>
      ))}
    </div>
  )
}

export function StatusNoteDialog({
  busy,
  onClose,
  onSubmit,
  status,
}: {
  busy: boolean
  onClose(): void
  onSubmit(note: string): void
  status: 'canceled' | 'waiting' | null
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const note = String(new FormData(event.currentTarget).get('status-note') ?? '').trim()
    if (note) onSubmit(note)
  }

  return (
    <Dialog isDismissable isOpen={status !== null} onOpenChange={(open) => !open && onClose()}>
      <form onSubmit={submit}>
        <DialogTitle>{status === 'waiting' ? 'Na co czekamy?' : 'Dlaczego anulujemy?'}</DialogTitle>
        <DialogDescription>
          Notatka będzie widoczna przy aktualnym statusie i w historii sprawy.
        </DialogDescription>
        <Field className="mt-4">
          <FieldLabel htmlFor="case-status-note">Notatka</FieldLabel>
          <Textarea
            autoFocus
            className="min-h-24 resize-y"
            id="case-status-note"
            maxLength={2_000}
            name="status-note"
            required
          />
        </Field>
        <DialogFooter>
          <Button isDisabled={busy} onPress={onClose} type="button" variant="outline">
            Wróć
          </Button>
          <Button
            isDisabled={busy}
            type="submit"
            variant={status === 'canceled' ? 'destructive' : 'default'}
          >
            {busy ? <Spinner aria-hidden="true" className="motion-reduce:animate-none" /> : null}
            {status === 'waiting' ? 'Ustaw oczekiwanie' : 'Anuluj sprawę'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

type CaseStatusAction =
  | {
      label: string
      requiresNote: true
      toStatus: 'canceled' | 'waiting'
      variant: 'outline' | 'destructive'
    }
  | {
      label: string
      requiresNote?: false
      toStatus: 'new' | 'postponed' | 'resolved' | 'working'
      variant: 'default' | 'outline'
    }

function caseStatusActions(caseItem: CaseItem): CaseStatusAction[] {
  if (caseItem.status === 'resolved' || caseItem.status === 'canceled') {
    return [{ label: 'Otwórz ponownie', toStatus: 'working', variant: 'outline' }]
  }

  if (caseItem.status === 'postponed') {
    return [
      { label: 'Przywróć', toStatus: 'new', variant: 'default' },
      { label: 'Rozwiąż', toStatus: 'resolved', variant: 'outline' },
      { label: 'Anuluj', requiresNote: true, toStatus: 'canceled', variant: 'destructive' },
    ]
  }

  return [
    ...(caseItem.status === 'new'
      ? ([
          { label: 'Pracuj', toStatus: 'working', variant: 'default' },
          { label: 'Odłóż', toStatus: 'postponed', variant: 'outline' },
        ] satisfies CaseStatusAction[])
      : []),
    ...(caseItem.status === 'new' || caseItem.status === 'working'
      ? ([
          { label: 'Oczekuj', requiresNote: true, toStatus: 'waiting', variant: 'outline' },
        ] satisfies CaseStatusAction[])
      : []),
    ...(caseItem.status === 'waiting'
      ? ([{ label: 'Wznów', toStatus: 'working', variant: 'default' }] satisfies CaseStatusAction[])
      : []),
    { label: 'Rozwiąż', toStatus: 'resolved', variant: 'outline' },
    { label: 'Anuluj', requiresNote: true, toStatus: 'canceled', variant: 'destructive' },
  ]
}
