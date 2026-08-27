import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '#components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '#components/ui/dialog'

export interface DraftController {
  key: string
  isDirty: boolean
  resetDraft(): void
}

interface PendingDiscardAction {
  cancel?(): void
  proceed(): void
}

export function useCaseDraftGuard() {
  const draftControllerRef = useRef<DraftController | null>(null)
  const pendingDiscardActionRef = useRef<PendingDiscardAction | null>(null)
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false)
  const [hasDirtyDraft, setHasDirtyDraft] = useState(false)

  useEffect(() => {
    if (!hasDirtyDraft) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [hasDirtyDraft])

  const requestDraftDiscard = useCallback((proceed: () => void, cancel?: () => void) => {
    if (!draftControllerRef.current?.isDirty) {
      proceed()
      return
    }
    if (pendingDiscardActionRef.current) return
    pendingDiscardActionRef.current = { ...(cancel ? { cancel } : {}), proceed }
    setDiscardPromptOpen(true)
  }, [])

  const registerDraftController = useCallback((controller: DraftController) => {
    draftControllerRef.current = controller
    setHasDirtyDraft(controller.isDirty)
    return () => {
      if (draftControllerRef.current?.key === controller.key) {
        draftControllerRef.current = null
        setHasDirtyDraft(false)
      }
    }
  }, [])

  const cancelDiscard = useCallback(() => {
    pendingDiscardActionRef.current?.cancel?.()
    pendingDiscardActionRef.current = null
    setDiscardPromptOpen(false)
  }, [])

  const discardDraft = useCallback((afterDiscard?: () => void) => {
    const action = pendingDiscardActionRef.current
    draftControllerRef.current?.resetDraft()
    draftControllerRef.current = null
    pendingDiscardActionRef.current = null
    setDiscardPromptOpen(false)
    setHasDirtyDraft(false)
    afterDiscard?.()
    action?.proceed()
  }, [])

  return {
    cancelDiscard,
    discardDraft,
    discardPromptOpen,
    registerDraftController,
    requestDraftDiscard,
  }
}

export function CaseDraftGuardDialog({
  isOpen,
  onCancel,
  onDiscard,
}: {
  isOpen: boolean
  onCancel(): void
  onDiscard(): void
}) {
  return (
    <Dialog isDismissable isOpen={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogTitle>Niezapisane zmiany</DialogTitle>
      <DialogDescription>
        Masz niezapisane zmiany tytułu lub opisu. Możesz zostać przy edycji albo świadomie je
        odrzucić.
      </DialogDescription>
      <DialogFooter>
        <Button autoFocus onPress={onCancel} type="button" variant="outline">
          Zostań przy edycji
        </Button>
        <Button onPress={onDiscard} type="button" variant="destructive">
          Odrzuć zmiany
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
