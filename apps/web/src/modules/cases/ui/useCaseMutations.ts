import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import {
  type CaseItem,
  type CaseTransitionIntent,
  caseQueryKeys,
  createCaseItem,
  isCaseVersionConflict,
  transitionCaseItem,
  updateCaseItem,
} from '../cases.api'
import type { CaseFormValue } from './case-workspace.shared'

export function useCaseMutations({
  onCreated,
  onTransitioned,
}: {
  onCreated(caseId: string): void
  onTransitioned(status: CaseItem['status']): void
}) {
  const queryClient = useQueryClient()
  const mutationLockRef = useRef(false)
  const [activeCaseMutation, setActiveCaseMutation] = useState<'transition' | 'update' | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: caseQueryKeys.all })

  const createMutation = useMutation({
    mutationFn: createCaseItem,
    onSuccess: async (created) => {
      onCreated(created.id)
      await refresh()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ current, input }: { current: CaseItem; input: CaseFormValue }) =>
      updateCaseItem(current, input),
    onError: async (error) => {
      if (isCaseVersionConflict(error)) await refresh()
    },
    onSuccess: refresh,
  })

  const transitionMutation = useMutation({
    mutationFn: ({ current, input }: { current: CaseItem; input: CaseTransitionIntent }) =>
      transitionCaseItem(current, input),
    onError: async (error) => {
      if (isCaseVersionConflict(error)) await refresh()
    },
    onSuccess: async (change) => {
      onTransitioned(change.toStatus)
      await refresh()
    },
  })

  const runUpdate = async (current: CaseItem, input: CaseFormValue) => {
    if (mutationLockRef.current) throw new Error('Inna operacja na sprawie jest już w toku.')
    mutationLockRef.current = true
    setActiveCaseMutation('update')
    try {
      return await updateMutation.mutateAsync({ current, input })
    } finally {
      mutationLockRef.current = false
      setActiveCaseMutation(null)
    }
  }

  const runTransition = async (current: CaseItem, input: CaseTransitionIntent): Promise<void> => {
    if (mutationLockRef.current) return
    mutationLockRef.current = true
    setActiveCaseMutation('transition')
    try {
      await transitionMutation.mutateAsync({ current, input })
    } catch {
      // The mutation exposes the error in the visible notice.
    } finally {
      mutationLockRef.current = false
      setActiveCaseMutation(null)
    }
  }

  const resetAll = () => {
    createMutation.reset()
    updateMutation.reset()
    transitionMutation.reset()
  }

  return {
    create: createMutation.mutateAsync,
    createError: createMutation.error,
    createPending: createMutation.isPending,
    mutationBusy:
      activeCaseMutation !== null || updateMutation.isPending || transitionMutation.isPending,
    resetAll,
    resetCreate: createMutation.reset,
    resetUpdate: updateMutation.reset,
    retryTransition: () => {
      if (!transitionMutation.variables) return
      return runTransition(transitionMutation.variables.current, transitionMutation.variables.input)
    },
    runTransition,
    runUpdate,
    transitionError: transitionMutation.error,
    updateError: updateMutation.error,
  }
}
