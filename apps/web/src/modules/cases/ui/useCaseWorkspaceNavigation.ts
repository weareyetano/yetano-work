import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useMediaQuery } from '#hooks/use-media-query'

import type { CaseItem, CaseListView } from '../cases.api'
export type CaseSelectionNavigationMode = 'push' | 'replace'

const LAST_VIEWED_CASE_KEY = 'yetano:last-viewed-case-id'
const DESKTOP_VIEW_QUERY = '(min-width: 721px)'

type RequestDraftDiscard = (proceed: () => void, cancel?: () => void) => void

export function useCaseWorkspaceNavigation({
  casesIsSuccess,
  createRequested,
  debouncedSearch,
  items,
  onCreateModeChange,
  onSelectedIdChange,
  requestDraftDiscard,
  requestedCase,
  requestedCaseIsError,
  requestedCaseIsPending,
  requestedFromList,
  requestedId,
  view,
}: {
  casesIsSuccess: boolean
  createRequested: boolean
  debouncedSearch: string
  items: CaseItem[]
  onCreateModeChange(open: boolean, navigationMode: CaseSelectionNavigationMode): void
  onSelectedIdChange(caseId: string | null, navigationMode: CaseSelectionNavigationMode): void
  requestDraftDiscard: RequestDraftDiscard
  requestedCase: CaseItem | null | undefined
  requestedCaseIsError: boolean
  requestedCaseIsPending: boolean
  requestedFromList: CaseItem | null
  requestedId: string | null
  view: CaseListView
}) {
  const [isCreating, setIsCreating] = useState(createRequested)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const previousRequestedIdRef = useRef(requestedId)
  const previousCreateRequestedRef = useRef(createRequested)
  const previousSelectedIdRef = useRef<string | null>(null)
  const lastViewedIdRef = useRef(readLastViewedCaseId())
  const workspaceRef = useRef<HTMLElement>(null)
  const listViewportRef = useRef<HTMLDivElement>(null)
  const detailViewportRef = useRef<HTMLDivElement>(null)
  const listTitleRef = useRef<HTMLHeadingElement>(null)
  const detailTitleInputRef = useRef<HTMLInputElement>(null)
  const createTitleRef = useRef<HTMLInputElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const mobileBackButtonRef = useRef<HTMLButtonElement>(null)
  const caseButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const listScrollPositionRef = useRef(0)
  const returnFocusCaseIdRef = useRef<string | null>(null)
  const returnFocusToAddRef = useRef(false)
  const pendingDetailFocusIdRef = useRef<string | null>(null)
  const pendingCreateFocusRef = useRef(false)
  const pendingDesktopAddFocusRef = useRef(false)
  const wasMobileDetailOpenRef = useRef(false)
  const isDesktop = useMediaQuery(DESKTOP_VIEW_QUERY, true)

  const commitCaseSelection = useCallback(
    (caseId: string | null, navigationMode: CaseSelectionNavigationMode = 'replace') => {
      if (selectedIdRef.current === caseId && (caseId !== null || requestedId === null)) return
      selectedIdRef.current = caseId
      setSelectedId(caseId)
      if (caseId) {
        lastViewedIdRef.current = caseId
        storeLastViewedCaseId(caseId)
      }
      onSelectedIdChange(caseId, navigationMode)
    },
    [onSelectedIdChange, requestedId],
  )

  const selectCase = useCallback(
    (
      caseId: string | null,
      navigationMode: CaseSelectionNavigationMode = 'replace',
      cancel?: () => void,
    ) => {
      if (selectedIdRef.current === caseId && (caseId !== null || requestedId === null)) return
      requestDraftDiscard(() => commitCaseSelection(caseId, navigationMode), cancel)
    },
    [commitCaseSelection, requestDraftDiscard, requestedId],
  )

  useLayoutEffect(() => {
    const previousRequestedId = previousRequestedIdRef.current
    previousRequestedIdRef.current = requestedId
    if (isDesktop || !previousRequestedId || requestedId) return
    requestDraftDiscard(
      () => {
        selectedIdRef.current = null
        setSelectedId(null)
      },
      () => onSelectedIdChange(previousRequestedId, 'replace'),
    )
  }, [isDesktop, onSelectedIdChange, requestDraftDiscard, requestedId])

  useLayoutEffect(() => {
    const wasCreateRequested = previousCreateRequestedRef.current
    if (wasCreateRequested === createRequested) return
    previousCreateRequestedRef.current = createRequested

    if (createRequested) {
      if (isCreating) return
      requestDraftDiscard(
        () => {
          if (selectedIdRef.current) previousSelectedIdRef.current = selectedIdRef.current
          selectedIdRef.current = null
          setSelectedId(null)
          setIsCreating(true)
        },
        () => onCreateModeChange(false, 'replace'),
      )
      return
    }

    if (wasCreateRequested && isCreating) {
      requestDraftDiscard(
        () => setIsCreating(false),
        () => onCreateModeChange(true, 'replace'),
      )
    }
  }, [createRequested, isCreating, onCreateModeChange, requestDraftDiscard])

  useEffect(() => {
    if (createRequested || isCreating) return
    if (requestedId) {
      if (requestedFromList || requestedCase?.id === requestedId) {
        selectCase(requestedId, 'replace', () =>
          onSelectedIdChange(selectedIdRef.current, 'replace'),
        )
        return
      }
      if (requestedCaseIsPending) return
    }

    if (!isDesktop || !casesIsSuccess) return
    const lastViewed = items.find((item) => item.id === lastViewedIdRef.current)
    selectCase(lastViewed?.id ?? items[0]?.id ?? null)
  }, [
    casesIsSuccess,
    createRequested,
    isDesktop,
    isCreating,
    items,
    onSelectedIdChange,
    requestedCase,
    requestedCaseIsPending,
    requestedFromList,
    requestedId,
    selectCase,
  ])

  const selected =
    items.find((item) => item.id === selectedId) ??
    (requestedCase?.id === selectedId ? requestedCase : null)
  const mobileDetailOpen = !isDesktop && Boolean(isCreating || selectedId || requestedId)

  useLayoutEffect(() => {
    if (!isDesktop || !listViewportRef.current) return
    listViewportRef.current.scrollTop = 0
  }, [debouncedSearch, isDesktop, view])

  useLayoutEffect(() => {
    if (!isDesktop || !detailViewportRef.current) return
    detailViewportRef.current.scrollTop = 0
  }, [isCreating, isDesktop, selected?.id])

  useEffect(() => {
    let restoreFrame: number | null = null
    let settledRestoreFrame: number | null = null

    if (isDesktop) {
      wasMobileDetailOpenRef.current = false
      return
    }

    const wasOpen = wasMobileDetailOpenRef.current
    if (mobileDetailOpen && !wasOpen) {
      pendingDetailFocusIdRef.current = isCreating ? null : (selectedId ?? requestedId)
      const workspace = workspaceRef.current
      if (workspace && typeof workspace.scrollIntoView === 'function') {
        workspace.scrollIntoView({ block: 'start' })
      }
    } else if (!mobileDetailOpen && wasOpen) {
      const returnTarget = returnFocusToAddRef.current
        ? addButtonRef.current
        : returnFocusCaseIdRef.current
          ? caseButtonRefs.current.get(returnFocusCaseIdRef.current)
          : null
      const scrollPosition = listScrollPositionRef.current
      restoreFrame = window.requestAnimationFrame(() => {
        settledRestoreFrame = window.requestAnimationFrame(() => {
          ;(returnTarget ?? listTitleRef.current)?.focus({ preventScroll: true })
          window.scrollTo({ behavior: 'auto', top: scrollPosition })
        })
      })
      returnFocusCaseIdRef.current = null
      returnFocusToAddRef.current = false
      pendingDetailFocusIdRef.current = null
    }
    wasMobileDetailOpenRef.current = mobileDetailOpen

    return () => {
      if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame)
      if (settledRestoreFrame !== null) window.cancelAnimationFrame(settledRestoreFrame)
    }
  }, [isCreating, isDesktop, mobileDetailOpen, requestedId, selectedId])

  useEffect(() => {
    if (!isCreating || !pendingCreateFocusRef.current) return
    createTitleRef.current?.focus({ preventScroll: true })
    pendingCreateFocusRef.current = false
  }, [isCreating])

  useEffect(() => {
    if (isCreating || !isDesktop || !pendingDesktopAddFocusRef.current) return
    addButtonRef.current?.focus({ preventScroll: true })
    pendingDesktopAddFocusRef.current = false
  }, [isCreating, isDesktop])

  useEffect(() => {
    if (!mobileDetailOpen || pendingDetailFocusIdRef.current === null) return
    if (selected?.id === pendingDetailFocusIdRef.current) {
      detailTitleInputRef.current?.focus({ preventScroll: true })
      pendingDetailFocusIdRef.current = null
      return
    }
    if (requestedCaseIsError) {
      mobileBackButtonRef.current?.focus({ preventScroll: true })
      pendingDetailFocusIdRef.current = null
    }
  }, [mobileDetailOpen, requestedCaseIsError, selected?.id])

  const openCreate = (resetCreate: () => void) => {
    requestDraftDiscard(() => {
      resetCreate()
      previousSelectedIdRef.current = selectedIdRef.current
      selectedIdRef.current = null
      setSelectedId(null)
      setIsCreating(true)
      pendingCreateFocusRef.current = true
      if (!isDesktop) {
        listScrollPositionRef.current = window.scrollY
        returnFocusToAddRef.current = true
      }
      onCreateModeChange(true, 'push')
    })
  }

  const cancelCreate = (resetCreate: () => void) => {
    requestDraftDiscard(() => {
      const previousSelectedId =
        previousSelectedIdRef.current ??
        (isDesktop
          ? (items.find((item) => item.id === lastViewedIdRef.current)?.id ?? items[0]?.id ?? null)
          : null)
      previousSelectedIdRef.current = null
      setIsCreating(false)
      resetCreate()

      if (previousSelectedId) commitCaseSelection(previousSelectedId, 'replace')
      else onCreateModeChange(false, 'replace')

      if (isDesktop) pendingDesktopAddFocusRef.current = true
    })
  }

  const openCase = (caseId: string, resetMutations: () => void) => {
    requestDraftDiscard(() => {
      setIsCreating(false)
      previousSelectedIdRef.current = null
      resetMutations()
      if (!isDesktop) {
        listScrollPositionRef.current = window.scrollY
        returnFocusCaseIdRef.current = caseId
      }
      commitCaseSelection(caseId, isDesktop ? 'replace' : 'push')
    })
  }

  const finishCreate = (caseId: string) => {
    setIsCreating(false)
    previousSelectedIdRef.current = null
    pendingDetailFocusIdRef.current = caseId
    commitCaseSelection(caseId, 'replace')
  }

  const closeMobileDetail = () => requestDraftDiscard(() => commitCaseSelection(null, 'replace'))

  return {
    addButtonRef,
    cancelCreate,
    caseButtonRefs,
    closeMobileDetail,
    commitCaseSelection,
    createTitleRef,
    detailTitleInputRef,
    detailViewportRef,
    finishCreate,
    isCreating,
    isDesktop,
    listTitleRef,
    listViewportRef,
    mobileBackButtonRef,
    mobileDetailOpen,
    openCase,
    openCreate,
    selected,
    selectedId,
    workspaceRef,
  }
}

function readLastViewedCaseId() {
  try {
    return window.localStorage.getItem(LAST_VIEWED_CASE_KEY)
  } catch {
    return null
  }
}

function storeLastViewedCaseId(caseId: string) {
  try {
    window.localStorage.setItem(LAST_VIEWED_CASE_KEY, caseId)
  } catch {
    // Selection still works when storage is unavailable.
  }
}
