import { type Ref, useCallback, useEffect, useState } from 'react'

import { CaseForm } from './CaseForm'
import {
  type CaseFormValue,
  caseFormValuesEqual,
  EMPTY_CASE_FORM_VALUE,
} from './case-workspace.shared'
import type { DraftController } from './useCaseDraftGuard'

export function CaseCreatePanel({
  busy,
  error,
  onCancel,
  registerDraftController,
  onSubmit,
  titleRef,
}: {
  busy: boolean
  error: Error | null
  onCancel(): void
  registerDraftController(controller: DraftController): () => void
  onSubmit(value: CaseFormValue): Promise<unknown>
  titleRef: Ref<HTMLInputElement>
}) {
  const [value, setValue] = useState<CaseFormValue>(EMPTY_CASE_FORM_VALUE)
  const isDirty = !caseFormValuesEqual(value, EMPTY_CASE_FORM_VALUE)
  const resetDraft = useCallback(() => setValue(EMPTY_CASE_FORM_VALUE), [])

  useEffect(() => {
    return registerDraftController({ key: 'new', isDirty, resetDraft })
  }, [isDirty, registerDraftController, resetDraft])

  return (
    <article aria-label="Nowa sprawa">
      <CaseForm
        ariaLabel="Nowa sprawa"
        busy={busy}
        busyLabel="Tworzenie…"
        error={error}
        isDirty={isDirty}
        value={value}
        onCancel={onCancel}
        onChange={setValue}
        onSubmit={onSubmit}
        submitLabel="Utwórz sprawę"
        titleRef={titleRef}
      />
    </article>
  )
}
