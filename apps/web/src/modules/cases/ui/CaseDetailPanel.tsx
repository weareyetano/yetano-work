import { type Ref, useCallback, useEffect, useRef, useState } from 'react'

import type { CaseItem, CaseTransitionIntent } from '../cases.api'
import { isCaseVersionConflict } from '../cases.api'
import { CaseConflictNotice, CaseForm } from './CaseForm'
import { CaseLifecycleActions, StatusNoteDialog } from './CaseLifecycleActions'
import { CaseStatusHistory } from './CaseStatusHistory'
import {
  type CaseFormValue,
  caseFormValue,
  caseFormValuesEqual,
  ErrorNotice,
} from './case-workspace.shared'
import type { DraftController } from './useCaseDraftGuard'

interface CaseDraftState {
  draft: CaseFormValue
  serverValue: CaseFormValue
  serverVersion: number
}

export function CaseDetailPanel({
  caseItem,
  headingLevel,
  isDesktop,
  mutationBusy,
  registerDraftController,
  onRetryTransition,
  onRequestDraftDiscard,
  onResetUpdateError,
  onTransition,
  onUpdate,
  titleRef,
  transitionError,
  updateError,
}: {
  caseItem: CaseItem
  headingLevel: 1 | 2
  isDesktop: boolean
  mutationBusy: boolean
  registerDraftController(controller: DraftController): () => void
  onRetryTransition(): void
  onRequestDraftDiscard(action: () => void): void
  onResetUpdateError(): void
  onTransition(input: CaseTransitionIntent): void
  onUpdate(current: CaseItem, input: CaseFormValue): Promise<CaseItem>
  titleRef: Ref<HTMLInputElement>
  transitionError: Error | null
  updateError: Error | null
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const [notedStatus, setNotedStatus] = useState<'canceled' | 'waiting' | null>(null)
  const [draftState, setDraftState] = useState<CaseDraftState>(() => createCaseDraft(caseItem))
  const compactStatusTriggerRef = useRef<HTMLButtonElement>(null)
  const isDirty = !caseFormValuesEqual(draftState.draft, draftState.serverValue)
  const resetDraft = useCallback((serverCase: CaseItem) => {
    setDraftState(createCaseDraft(serverCase))
  }, [])
  const discardDraft = useCallback(() => resetDraft(caseItem), [caseItem, resetDraft])

  useEffect(() => {
    setDraftState((current) => {
      if (current.serverVersion === caseItem.version) return current
      if (!caseFormValuesEqual(current.draft, current.serverValue)) return current
      return createCaseDraft(caseItem)
    })
  }, [caseItem])

  useEffect(() => {
    return registerDraftController({ key: caseItem.id, isDirty, resetDraft: discardDraft })
  }, [caseItem.id, discardDraft, isDirty, registerDraftController])

  const transition = (toStatus: CaseTransitionIntent['toStatus'], note?: string) => {
    onTransition({
      ...(note ? { note } : {}),
      toStatus,
      transitionId: crypto.randomUUID(),
    } as CaseTransitionIntent)
  }

  const update = async (input: CaseFormValue) => {
    const updated = await onUpdate({ ...caseItem, version: draftState.serverVersion }, input)
    resetDraft(updated)
    return updated
  }

  const updateConflict = isCaseVersionConflict(updateError)
  const transitionConflict = isCaseVersionConflict(transitionError)

  return (
    <article aria-labelledby="selected-case-title">
      <Heading className="sr-only" id="selected-case-title">
        {caseItem.title}
      </Heading>
      {transitionError ? (
        <ErrorNotice
          error={transitionError}
          {...(transitionConflict ? {} : { retry: onRetryTransition })}
        />
      ) : null}
      {updateConflict ? (
        <CaseConflictNotice
          draft={draftState.draft}
          serverCase={caseItem}
          serverVersion={draftState.serverVersion}
          onLoadServerVersion={() => {
            resetDraft(caseItem)
            onResetUpdateError()
          }}
        />
      ) : null}
      <CaseForm
        busy={mutationBusy}
        error={updateConflict ? null : updateError}
        footerActions={
          <CaseLifecycleActions
            busy={mutationBusy}
            caseItem={caseItem}
            compactTriggerRef={compactStatusTriggerRef}
            isDesktop={isDesktop}
            onNotedTransition={(status) => onRequestDraftDiscard(() => setNotedStatus(status))}
            onTransition={(status) => onRequestDraftDiscard(() => transition(status))}
          />
        }
        isDirty={isDirty}
        value={draftState.draft}
        onChange={(draft) => setDraftState((current) => ({ ...current, draft }))}
        onSubmit={update}
        submitLabel="Zapisz"
        titleRef={titleRef}
      />
      <CaseStatusHistory caseId={caseItem.id} />
      <StatusNoteDialog
        busy={mutationBusy}
        status={notedStatus}
        onClose={() => {
          setNotedStatus(null)
          window.setTimeout(() => compactStatusTriggerRef.current?.focus(), 0)
        }}
        onSubmit={(note) => {
          if (!notedStatus) return
          transition(notedStatus, note)
          setNotedStatus(null)
          window.setTimeout(() => compactStatusTriggerRef.current?.focus(), 0)
        }}
      />
    </article>
  )
}

function createCaseDraft(serverCase: CaseItem): CaseDraftState {
  const serverValue = caseFormValue(serverCase)
  return { draft: serverValue, serverValue, serverVersion: serverCase.version }
}
